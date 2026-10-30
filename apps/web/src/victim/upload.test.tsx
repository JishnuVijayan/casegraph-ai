import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCase } from './useCase';

const brief = {
  caseId: 'c1', reference: 'CG-2026-000001', status: 'DRAFT', category: 'other', categoryLabel: 'Another cyber crime', title: 'New complaint', summary: '',
  totalLoss: null, completeness: { percent: 0, missing: [] }, timeline: [], facts: [], entities: [], questions: [], evidence: [], narratives: [],
  analysis: { state: 'IDLE', updatedAt: null },
};

let inFlight = 0, mostAtOnce = 0, sends = 0, busyOnce = true;

class FakeXhr {
  status = 0; responseText = '';
  upload = { onprogress: null as null | ((e: ProgressEvent) => void) };
  onload: null | (() => void) = null; onerror: null | (() => void) = null;
  open() { /* no-op */ }
  setRequestHeader() { /* no-op */ }
  send() {
    sends += 1; inFlight += 1; mostAtOnce = Math.max(mostAtOnce, inFlight);
    const busy = busyOnce && sends === 1; if (busy) busyOnce = false; // the very first try is told the server is busy
    setTimeout(() => {
      inFlight -= 1;
      this.status = busy ? 429 : 201;
      this.responseText = JSON.stringify(busy ? { error: { message: 'Busy' } } : { data: { id: `e${sends}` } });
      this.onload?.();
    }, 15);
  }
}

function Harness({ files }: { files: File[] }) {
  const c = useCase('c1', 'tok', () => undefined);
  return (
    <div>
      <button onClick={() => c.addFiles(files)}>go</button>
      <p data-testid="left">{c.uploads.length}</p>
      <p data-testid="failed">{c.uploads.filter((u) => u.status === 'failed').length}</p>
    </div>
  );
}

beforeEach(() => {
  inFlight = 0; mostAtOnce = 0; sends = 0; busyOnce = true;
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => undefined }));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: brief, requestId: 'r' }), { status: 200 })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('adding several files at once', () => {
  it('sends them one after another and retries a busy answer instead of showing an error', async () => {
    const files = ['a.png', 'b.png', 'c.png'].map((n) => new File([new Uint8Array([1, 2, 3])], n, { type: 'image/png' }));
    render(<Harness files={files} />);
    await act(async () => { fireEvent.click(screen.getByText('go')); });
    await waitFor(() => expect(screen.getByTestId('left').textContent).toBe('0'), { timeout: 4000 });
    expect(mostAtOnce).toBe(1); // never more than one upload in flight
    expect(sends).toBe(4); // 3 files + 1 retry after "busy"
    expect(screen.getByTestId('failed').textContent).toBe('0');
  });
});
