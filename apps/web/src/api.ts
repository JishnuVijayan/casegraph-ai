export class ApiFailure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

const OFFLINE = 'We could not reach the service. Please check your internet connection and try again.';

export async function api<T>(path: string, token?: string, body?: object | FormData, method = 'GET'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { method, cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiFailure(503, OFFLINE); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiFailure(response.status, payload?.error?.message ?? 'Something went wrong. Please try again.');
  return payload.data;
}

/** Plain-language message for any thrown value. */
export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong. Please try again.';
}

/** Multipart upload with progress (0..1). Resolves with the response `data`. */
export function uploadWithProgress<T>(path: string, token: string, file: File, onProgress: (fraction: number) => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `/api/v1${path}`);
    request.setRequestHeader('Authorization', `Bearer ${token}`);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onerror = () => reject(new ApiFailure(503, OFFLINE));
    request.onload = () => {
      let payload: { data?: T; error?: { message?: string } } | null = null;
      try { payload = JSON.parse(request.responseText); } catch { payload = null; }
      if (request.status >= 200 && request.status < 300) { onProgress(1); resolve(payload?.data as T); }
      else reject(new ApiFailure(request.status, payload?.error?.message ?? 'This file could not be added. Please try again.'));
    };
    const data = new FormData();
    data.append('file', file);
    request.send(data);
  });
}

/** Authenticated GET returning raw bytes (previews, report download). */
export async function fetchBlob(path: string, token: string): Promise<Blob> {
  let response: Response;
  try { response = await fetch(`/api/v1${path}`, { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }); }
  catch { throw new ApiFailure(503, OFFLINE); }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiFailure(response.status, payload?.error?.message ?? 'This file could not be opened. Please try again.');
  }
  return response.blob();
}

export async function downloadFile(path: string, token: string, filename: string): Promise<void> {
  const blob = await fetchBlob(path, token);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
