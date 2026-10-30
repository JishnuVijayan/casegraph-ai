import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from 'react';
import type { Brief } from '../types.v2';
import { useDictation } from '../voice/useDictation';
import { Attachments } from './Attachments';
import { CameraIcon, ClipIcon, MicIcon, StopIcon } from './icons';
import { useToast } from './toast';
import { ACCEPT, type UploadItem } from './useCase';

const LANG_KEY = 'cg.voiceLang';
function savedLang(): string {
  try { return localStorage.getItem(LANG_KEY) || 'en-IN'; } catch { return 'en-IN'; }
}

export type Draft = { text: string; voice: boolean };
type Props = {
  brief: Brief; caseId: string; token: string; uploads: UploadItem[]; draft: Draft; fix: boolean;
  onDraft: (update: (text: string) => string, voice?: boolean) => void;
  onFiles: (files: File[]) => string[];
  onDelete: (id: string) => Promise<void>; onRetry: (key: string) => void; onDismiss: (key: string) => void;
  onContinue: () => void; continuing: boolean;
};

/** Step 1. One calm screen: say it, add proof, continue. */
export function StepTell(p: Props) {
  const { brief, draft } = p;
  const toast = useToast();
  const [lang, setLang] = useState(savedLang);
  const [langOpen, setLangOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const dictation = useDictation((phrase) =>
    p.onDraft((current) => (current && !/\s$/.test(current) ? `${current} ` : current) + phrase, true));

  useEffect(() => { if (p.fix) area.current?.focus(); }, [p.fix]);
  useEffect(() => {
    const el = area.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(Math.max(el.scrollHeight, 150), 420)}px`;
  }, [draft.text, dictation.interim]);

  const shown = draft.text + (dictation.interim ? `${draft.text && !/\s$/.test(draft.text) ? ' ' : ''}${dictation.interim}` : '');
  const uploading = p.uploads.some((u) => u.status === 'uploading');
  const hasSomething = draft.text.trim().length > 0 || brief.narratives.length > 0 || brief.evidence.length > 0 || p.uploads.length > 0;
  const canContinue = hasSomething && !uploading && !p.continuing;
  const langLabel = dictation.languages.find((l) => l.code === lang)?.label ?? 'English';

  function takeFiles(list: FileList | File[] | null) {
    const files = list ? Array.from(list) : [];
    if (files.length) p.onFiles(files).forEach((m) => toast(m, 'error'));
  }
  function onDrop(e: DragEvent) { e.preventDefault(); setDragging(false); takeFiles(e.dataTransfer.files); }
  function onPaste(e: ClipboardEvent) {
    const files = Array.from(e.clipboardData.files);
    if (files.length) { e.preventDefault(); takeFiles(files); }
  }

  return (
    <>
      <div className="v-screen"
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
        onDrop={onDrop}>
        <h1 className="v-h1" tabIndex={-1}>{p.fix ? 'What should we fix?' : 'Tell us what happened'}</h1>
        <p className="v-lead">
          {p.fix ? 'Tell us what is wrong or missing. We will update your story.' : 'Say it the way you would tell a friend. Take your time. You can add more later.'}
        </p>
        <p className="v-chips-label" id="v-help-label">It helps to say:</p>
        <ul className="v-hint-chips" aria-labelledby="v-help-label">
          <li>When it happened</li><li>Who or what was involved</li><li>What you lost or what they did</li>
        </ul>

        <div className={`v-box${dictation.listening ? ' is-listening' : ''}`}>
          <label htmlFor="v-story" className="sr-only">Describe what happened</label>
          <textarea id="v-story" ref={area} className="v-story" rows={6} value={shown}
            placeholder="For example: Someone took over my Instagram account on Monday and is messaging my friends. Or: a man called saying he was from my bank and 12,000 rupees left my account."
            onChange={(e) => { if (dictation.interim) dictation.stop(); const v = e.target.value; p.onDraft(() => v); }}
            onPaste={onPaste} />
          {dictation.listening && (
            <p className="v-listening" role="status"><span className="v-wave" aria-hidden="true"><i /><i /><i /><i /></span> Listening. Speak now.</p>
          )}
        </div>

        <div className="v-voice-row">
          <button type="button" className={`v-mic-big${dictation.listening ? ' is-on' : ''}`} aria-pressed={dictation.listening}
            onClick={() => (dictation.listening ? dictation.stop() : dictation.start(lang))}>
            {dictation.listening ? <StopIcon size={22} /> : <MicIcon size={22} />}
            <span>{dictation.listening ? 'Tap to stop' : 'Speak instead'}</span>
          </button>
          <div className="v-lang">
            <button type="button" className="v-link v-lang-btn" aria-expanded={langOpen} onClick={() => setLangOpen((o) => !o)}>
              Language: {langLabel}
            </button>
            {langOpen && (
              <>
                <label className="sr-only" htmlFor="v-lang">Language for speaking</label>
                <select id="v-lang" className="cg-input v-select" value={lang} disabled={dictation.listening}
                  onChange={(e) => { setLang(e.target.value); try { localStorage.setItem(LANG_KEY, e.target.value); } catch { /* ignore */ } }}>
                  {dictation.languages.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
        {dictation.error && <p className="v-error" role="alert">{dictation.error}</p>}
        {!dictation.supported && !dictation.error && <p className="v-hint">Speaking is not available in this browser. You can type, or try Chrome, Edge or Safari.</p>}

        <h2 className="v-h2">Add screenshots or documents</h2>
        <p className="v-hint">Chats, screenshots, profile pages, emails, receipts, photos or PDFs. We read them for you.</p>
        <button type="button" className={`v-drop${dragging ? ' is-over' : ''}`} onClick={() => fileInput.current?.click()}>
          <span className="v-drop-icon" aria-hidden="true"><ClipIcon size={26} /></span>
          <span className="v-drop-title">{dragging ? 'Drop to add' : 'Tap to add files'}</span>
          <span className="v-drop-sub">or drag and drop here</span>
        </button>
        <button type="button" className="cg-btn cg-btn--ghost v-camera" onClick={() => cameraInput.current?.click()}><CameraIcon size={18} /> Take a photo</button>
        <input ref={fileInput} type="file" hidden multiple accept={ACCEPT} aria-label="Choose files to add"
          onChange={(e) => { takeFiles(e.target.files); e.target.value = ''; }} />
        <input ref={cameraInput} type="file" hidden accept="image/*" capture="environment" aria-label="Take a photo"
          onChange={(e) => { takeFiles(e.target.files); e.target.value = ''; }} />

        <Attachments caseId={p.caseId} token={p.token} evidence={brief.evidence} uploads={p.uploads}
          onDelete={p.onDelete} onRetry={p.onRetry} onDismiss={p.onDismiss} />

        {brief.narratives.length > 0 && (
          <details className="v-told">
            <summary>What you already told us ({brief.narratives.length})</summary>
            <ol className="v-told-list">
              {brief.narratives.map((n) => (
                <li key={n.id} className="v-bubble">
                  <p>{n.text}</p>
                  <span className="v-bubble-meta">{n.channel === 'voice' ? 'Spoken' : 'Typed'}</span>
                </li>
              ))}
            </ol>
          </details>
        )}
      </div>

      <div className="v-actionbar">
        <p className="v-action-note" aria-live="polite">
          {uploading ? 'Adding your files…' : !hasSomething ? 'Write, speak or add a file to go on.' : 'Everything is saved as you go.'}
        </p>
        <button type="button" className="cg-btn v-primary" disabled={!canContinue} onClick={p.onContinue}>
          {p.continuing ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </>
  );
}
