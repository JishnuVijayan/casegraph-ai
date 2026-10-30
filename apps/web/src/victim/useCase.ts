import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiFailure, errorMessage, uploadWithProgress } from '../api';
import type { Brief, CategoryId, Narrative, SubmitResult } from '../types.v2';

export type UploadItem = {
  key: string; name: string; mime: string; size: number; previewUrl?: string;
  progress: number; status: 'uploading' | 'failed'; error?: string; file: File;
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf,text/plain,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const ALLOWED = /^(image\/(png|jpeg|webp)|application\/pdf|text\/plain|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;
const ANALYZE_DELAY = 1200;

export function fileProblem(file: File): string | null {
  const okType = ALLOWED.test(file.type) || /\.(png|jpe?g|webp|pdf|txt|docx)$/i.test(file.name);
  if (!okType) return `"${file.name}" is not a type we can read. Please add a photo, screenshot, PDF, Word or text file.`;
  if (file.size > MAX_FILE_BYTES) return `"${file.name}" is larger than 20 MB. Please add a smaller file.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  return null;
}

/** All server interaction for one complaint. Everything the person adds is sent at once; AI reading is debounced. */
export function useCase(caseId: string, token: string, onAuthLost: () => void) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loadError, setLoadError] = useState('');
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [queued, setQueued] = useState(false);
  const [running, setRunning] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runningRef = useRef(false);
  const again = useRef(false);
  const alive = useRef(true);
  const authLost = useRef(onAuthLost);
  useEffect(() => { authLost.current = onAuthLost; });
  const enc = encodeURIComponent(caseId);

  const guard = useCallback((failure: unknown) => {
    if (failure instanceof ApiFailure && failure.status === 401) authLost.current();
    return errorMessage(failure);
  }, []);

  const mergeBrief = useCallback((incoming: Brief) => {
    setBrief((current) => {
      if (!current) return incoming;
      const known = new Set(incoming.narratives.map((n) => n.id));
      const extra = current.narratives.filter((n) => !known.has(n.id));
      return extra.length ? { ...incoming, narratives: [...incoming.narratives, ...extra] } : incoming;
    });
  }, []);

  const load = useCallback(async () => {
    setLoadError('');
    try { const b = await api<Brief>(`/cases/${enc}/brief`, token); if (alive.current) setBrief(b); }
    catch (f) { if (alive.current) setLoadError(guard(f)); }
  }, [enc, token, guard]);

  useEffect(() => { alive.current = true; void load(); return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); }; }, [load]);

  const runAnalyze = useCallback(async () => {
    if (runningRef.current) { again.current = true; return; }
    runningRef.current = true; setRunning(true); setQueued(false); setAnalysisError('');
    try {
      const result = await api<Brief>(`/cases/${enc}/analyze`, token, {}, 'POST');
      if (alive.current) mergeBrief(result);
    } catch (f) { if (alive.current) setAnalysisError(guard(f)); }
    finally {
      runningRef.current = false;
      if (alive.current) setRunning(false);
      if (again.current && alive.current) { again.current = false; void runAnalyze(); }
    }
  }, [enc, token, guard, mergeBrief]);

  const scheduleAnalyze = useCallback((delay = ANALYZE_DELAY) => {
    if (timer.current) clearTimeout(timer.current);
    setQueued(true);
    timer.current = setTimeout(() => { timer.current = null; void runAnalyze(); }, delay);
  }, [runAnalyze]);

  const sendNarrative = useCallback(async (text: string, channel: 'typed' | 'voice') => {
    const saved = await api<Narrative>(`/cases/${enc}/narrative`, token, { text, channel }, 'POST').catch((f) => { throw new Error(guard(f)); });
    setBrief((b) => b ? { ...b, narratives: [...b.narratives, saved] } : b);
    scheduleAnalyze();
    return saved;
  }, [enc, token, guard, scheduleAnalyze]);

  const startUpload = useCallback(async (item: UploadItem) => {
    const patch = (p: Partial<UploadItem>) => setUploads((all) => all.map((u) => u.key === item.key ? { ...u, ...p } : u));
    patch({ status: 'uploading', progress: 0, error: undefined });
    try {
      // The server may answer "busy" for a moment when several files arrive together; wait and try again before showing an error.
      for (let attempt = 0; ; attempt += 1) {
        try { await uploadWithProgress(`/cases/${enc}/evidence`, token, item.file, (progress) => patch({ progress })); break; }
        catch (f) {
          if (attempt < 3 && f instanceof ApiFailure && (f.status === 429 || f.status === 503)) { patch({ progress: 0 }); await new Promise((r) => setTimeout(r, 900 * (attempt + 1))); continue; }
          throw f;
        }
      }
      const fresh = await api<Brief>(`/cases/${enc}/brief`, token);
      if (!alive.current) return;
      mergeBrief(fresh);
      setUploads((all) => all.filter((u) => u.key !== item.key));
      scheduleAnalyze();
    } catch (f) { if (alive.current) patch({ status: 'failed', error: guard(f) }); }
  }, [enc, token, guard, mergeBrief, scheduleAnalyze]);

  /** Returns messages for files that were refused. */
  const uploadChain = useRef<Promise<unknown>>(Promise.resolve());
  const addFiles = useCallback((files: File[]): string[] => {
    const problems: string[] = [];
    const items: UploadItem[] = [];
    for (const file of files) {
      const problem = fileProblem(file);
      if (problem) { problems.push(problem); continue; }
      items.push({
        key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: file.name || 'Pasted image', mime: file.type, size: file.size,
        previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined, progress: 0, status: 'uploading', file,
      });
    }
    // One file at a time, in the order chosen, so a batch never overloads the server.
    if (items.length) { setUploads((all) => [...all, ...items]); items.forEach((i) => { uploadChain.current = uploadChain.current.then(() => startUpload(i)); }); }
    return problems;
  }, [startUpload]);

  const retryUpload = useCallback((key: string) => {
    const item = uploads.find((u) => u.key === key); if (item) uploadChain.current = uploadChain.current.then(() => startUpload(item));
  }, [uploads, startUpload]);
  const dismissUpload = useCallback((key: string) => setUploads((all) => all.filter((u) => u.key !== key)), []);

  const deleteEvidence = useCallback(async (evidenceId: string) => {
    await api(`/cases/${enc}/evidence/${encodeURIComponent(evidenceId)}`, token, undefined, 'DELETE').catch((f) => { throw new Error(guard(f)); });
    setBrief((b) => b ? { ...b, evidence: b.evidence.filter((e) => e.id !== evidenceId) } : b);
    scheduleAnalyze();
  }, [enc, token, guard, scheduleAnalyze]);

  const answer = useCallback(async (questionId: string, text: string) => {
    setBrief((b) => b ? { ...b, questions: b.questions.map((q) => q.id === questionId
      ? { ...q, status: text === 'UNKNOWN' ? 'UNKNOWN' : 'ANSWERED', answer: text } : q) } : b);
    try {
      const next = await api<Brief>(`/cases/${enc}/questions/${encodeURIComponent(questionId)}/answer`, token, { answer: text }, 'POST');
      mergeBrief(next);
    } catch (f) { await load(); throw new Error(guard(f)); }
  }, [enc, token, guard, mergeBrief, load]);

  const patch = useCallback(async (fields: { category?: CategoryId; title?: string }) => {
    try { mergeBrief(await api<Brief>(`/cases/${enc}`, token, fields, 'PATCH')); }
    catch (f) { throw new Error(guard(f)); }
  }, [enc, token, guard, mergeBrief]);

  const submit = useCallback(async () => {
    try {
      const result = await api<SubmitResult>(`/cases/${enc}/submit`, token, {}, 'POST');
      await load();
      return result;
    } catch (f) { throw new Error(guard(f)); }
  }, [enc, token, guard, load]);

  const analyzing = running || queued || (brief?.analysis.state === 'RUNNING');
  return useMemo(() => ({
    brief, loadError, reload: load, uploads, addFiles, retryUpload, dismissUpload, deleteEvidence,
    sendNarrative, answer, patch, submit, analyzing, analysisError, analyzeNow: () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; setQueued(false); } void runAnalyze(); },
  }), [brief, loadError, load, uploads, addFiles, retryUpload, dismissUpload, deleteEvidence, sendNarrative, answer, patch, submit, analyzing, analysisError, runAnalyze]);
}
