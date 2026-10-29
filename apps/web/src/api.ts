export class ApiFailure extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export async function api<T>(path: string, token?: string, body?: object | FormData, method = 'GET'): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, { method, cache: 'no-store',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined });
  } catch { throw new ApiFailure(503, 'Local API unavailable. Start the local services and retry.'); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new ApiFailure(response.status, payload?.error?.message ?? 'Local request failed.');
  return payload.data;
}
