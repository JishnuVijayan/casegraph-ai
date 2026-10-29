import { useEffect, useRef, useState } from 'react';
import { ApiFailure, api } from './api';

type Source = { evidenceId: string; regionId: string | null; observedText: string | null;
  textSpan: { start: number; end: number } | null; boundingBox: { x: number; y: number; width: number; height: number } | null };
type Revision = { before: { rawValue: string; normalizedValue: unknown }; after: { rawValue: string; normalizedValue: unknown }; reason: string | null; changedAt: string };
type Claim = { id: string; type: string; rawValue: string; normalizedValue: unknown; sourceKind: string;
  verificationStatus: string; sources: Source[]; revisions: Revision[] };
type TimelineClaim = { claimId: string; type: string; rawValue: string; sourceKind: string; verificationStatus: string;
  evidenceId: string | null; regionId: string | null; observedText: string | null };
type Event = { id: string; eventType: string; occurredAt: string | null; precision: string; uncertainty: string; claims: TimelineClaim[] };

const claimTypes = ['payment_amount', 'payment_reference', 'incident_time', 'contact_identifier', 'statement'];
const eventTypes = ['payment', 'contact', 'account_action', 'other'];
const precisions = ['EXACT', 'APPROXIMATE', 'DATE_ONLY', 'UNKNOWN'];

function timeLabel(event: Event) {
  if (event.precision === 'UNKNOWN' || !event.occurredAt) return 'UNKNOWN';
  return event.precision === 'DATE_ONLY' ? event.occurredAt.slice(0, 10) : event.occurredAt;
}

export function ReviewPanel({ token, caseId, owner, busy, refreshKey, perform }: {
  token: string; caseId: string; owner: boolean; busy: boolean; refreshKey: number;
  perform: (operation: () => Promise<void>) => Promise<void>;
}) {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimType, setClaimType] = useState('statement');
  const [claimValue, setClaimValue] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [eventType, setEventType] = useState('payment');
  const [precision, setPrecision] = useState('UNKNOWN');
  const [occurredAt, setOccurredAt] = useState('');
  const [uncertainty, setUncertainty] = useState('');
  const [selectedClaims, setSelectedClaims] = useState<string[]>([]);
  const [error, setError] = useState('');
  const performRef = useRef(perform);
  useEffect(() => { performRef.current = perform; });

  useEffect(() => {
    let current = true;
    setLoading(true); setError('');
    Promise.all([
      api<Claim[]>(`/cases/${caseId}/claims`, token),
      api<Event[]>(`/cases/${caseId}/timeline`, token),
    ]).then(([nextClaims, nextEvents]) => {
      if (current) { setClaims(nextClaims); setEvents(nextEvents); }
    }).catch((failure: unknown) => {
      if (!current) return;
      if (failure instanceof ApiFailure && (failure.status === 401 || failure.status === 403)) { setClaims([]); setEvents([]); }
      setError(failure instanceof Error ? failure.message : 'Review data unavailable.');
      void performRef.current(async () => { throw failure; });
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [token, caseId, refreshKey]);

  async function run(operation: () => Promise<void>) {
    setError('');
    await perform(async () => {
      try { await operation(); }
      catch (failure) {
        if (failure instanceof ApiFailure && (failure.status === 401 || failure.status === 403)) { setClaims([]); setEvents([]); }
        throw failure;
      }
    });
  }
  async function reload() {
    const [nextClaims, nextEvents] = await Promise.all([
      api<Claim[]>(`/cases/${caseId}/claims`, token), api<Event[]>(`/cases/${caseId}/timeline`, token),
    ]);
    setClaims(nextClaims); setEvents(nextEvents);
  }

  return <section aria-label="Claims and timeline review" className="my-4 rounded border p-4">
    <h3 className="text-lg font-bold">Claims and timeline review</h3>
    <p>Source observations and recollections are unverified. Corrections change only the interpretation; the source and revision history remain visible.</p>
    {loading && <p role="status">Loading claims and timeline…</p>}
    {error && <p role="alert">{error}</p>}
    {owner && <form onSubmit={(event) => { event.preventDefault(); void run(async () => {
      await api('/cases/' + caseId + '/claims', token, { type: claimType, sourceKind: 'VICTIM_RECOLLECTION', rawValue: claimValue }, 'POST');
      setClaimValue(''); await reload();
    }); }}>
      <h4 className="font-semibold">Add a recollection</h4>
      <label htmlFor="claim-type">Claim type</label>
      <select id="claim-type" value={claimType} disabled={busy} onChange={(event) => setClaimType(event.target.value)}>
        {claimTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
      </select>
      <label htmlFor="claim-value">What do you recall?</label>
      <input id="claim-value" value={claimValue} maxLength={500} required disabled={busy} onChange={(event) => setClaimValue(event.target.value)} />
      <button type="submit" disabled={busy}>Save unverified recollection</button>
    </form>}
    <h4 className="mt-4 font-semibold">Claims</h4>
    {!loading && claims.length === 0 && <p>No claims recorded. Run local OCR to save an observed amount or add a recollection.</p>}
    <ul>{claims.map((claim) => <li key={claim.id} className="my-3 rounded border p-3">
      <p>{claim.type.replaceAll('_', ' ')}: <strong>{claim.rawValue}</strong></p>
      <p>{claim.sourceKind} · {claim.verificationStatus}</p>
      {Boolean(claim.normalizedValue) && <p>Deterministic normalized value: <code>{JSON.stringify(claim.normalizedValue)}</code></p>}
      {claim.sources.map((source) => <p key={`${claim.id}-${source.evidenceId}`}>
        Source {source.evidenceId}{source.regionId ? ` · OCR region ${source.regionId}` : ''}
        {source.observedText ? ` · observed “${source.observedText}”` : ''}
        {source.textSpan ? ` · text span ${source.textSpan.start}–${source.textSpan.end}` : ''}
      </p>)}
      {claim.revisions.length > 0 && <details><summary>Revision history ({claim.revisions.length})</summary>
        <ol>{claim.revisions.map((revision, index) => <li key={`${claim.id}-${revision.changedAt}-${index}`}>
          <p>Before: {revision.before.rawValue}</p><p>After: {revision.after.rawValue}</p>
          {revision.reason && <p>Reason: {revision.reason}</p>}
        </li>)}</ol>
      </details>}
      {owner && <form onSubmit={(event) => { event.preventDefault(); void run(async () => {
        await api(`/cases/${caseId}/claims/${claim.id}`, token, { rawValue: edits[claim.id] ?? claim.rawValue, reason: reason[claim.id] || undefined }, 'PATCH');
        await reload();
      }); }}>
        <label htmlFor={`correct-${claim.id}`}>Correct interpreted value</label>
        <input id={`correct-${claim.id}`} value={edits[claim.id] ?? claim.rawValue} maxLength={500} required disabled={busy}
          onChange={(event) => setEdits((current) => ({ ...current, [claim.id]: event.target.value }))} />
        <label htmlFor={`reason-${claim.id}`}>Correction note (optional)</label>
        <input id={`reason-${claim.id}`} value={reason[claim.id] ?? ''} maxLength={240} disabled={busy}
          onChange={(event) => setReason((current) => ({ ...current, [claim.id]: event.target.value }))} />
        <button type="submit" disabled={busy}>Save correction with history</button>
      </form>}
    </li>)}</ul>

    <section aria-label="Case timeline">
      <h4 className="mt-4 font-semibold">Timeline</h4>
      {events.length === 0 && !loading && <p>No timeline events yet.</p>}
      <ol>{events.map((item) => <li key={item.id} className="my-2 border-l-2 pl-3">
        <strong>{item.eventType.replaceAll('_', ' ')} · {timeLabel(item)} ({item.precision})</strong>
        <p>Uncertainty: {item.uncertainty}</p>
        <ul>{item.claims.map((claim) => <li key={claim.claimId}>{claim.rawValue} · {claim.sourceKind} · {claim.verificationStatus}
          {claim.evidenceId && ` · source ${claim.evidenceId}`}{claim.observedText && ` · observed “${claim.observedText}”`}
        </li>)}</ul>
      </li>)}</ol>
      {owner && claims.length > 0 && <form onSubmit={(event) => { event.preventDefault(); void run(async () => {
        await api(`/cases/${caseId}/timeline`, token, { eventType, precision,
          ...(precision === 'UNKNOWN' ? {} : { occurredAt }), uncertainty, claimIds: selectedClaims }, 'POST');
        setOccurredAt(''); setUncertainty(''); setSelectedClaims([]); await reload();
      }); }}>
        <h4 className="font-semibold">Add a timeline event</h4>
        <label htmlFor="timeline-type">Event type</label>
        <select id="timeline-type" value={eventType} disabled={busy} onChange={(event) => setEventType(event.target.value)}>
          {eventTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}
        </select>
        <label htmlFor="timeline-precision">Time precision</label>
        <select id="timeline-precision" value={precision} disabled={busy} onChange={(event) => setPrecision(event.target.value)}>
          {precisions.map((value) => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select>
        {precision !== 'UNKNOWN' && <>
          <label htmlFor="timeline-time">{precision === 'DATE_ONLY' ? 'Date (YYYY-MM-DD)' : 'Timestamp with timezone'}</label>
          <input id="timeline-time" value={occurredAt} placeholder={precision === 'DATE_ONLY' ? '2026-10-29' : '2026-10-29T12:30:00+05:30'}
            required disabled={busy} onChange={(event) => setOccurredAt(event.target.value)} />
        </>}
        <label htmlFor="timeline-uncertainty">Uncertainty/source note</label>
        <input id="timeline-uncertainty" value={uncertainty} maxLength={240} required disabled={busy}
          onChange={(event) => setUncertainty(event.target.value)} />
        <fieldset><legend>Supporting claims</legend>{claims.map((claim) => <label key={claim.id}>
          <input type="checkbox" checked={selectedClaims.includes(claim.id)} disabled={busy}
            onChange={(event) => setSelectedClaims((current) => event.target.checked ? [...current, claim.id] : current.filter((id) => id !== claim.id))} />
          {claim.rawValue} · {claim.sourceKind}
        </label>)}</fieldset>
        <button type="submit" disabled={busy || selectedClaims.length === 0}>Add linked timeline event</button>
      </form>}
    </section>
  </section>;
}
