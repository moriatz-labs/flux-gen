export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  fetchImplementation: typeof fetch = fetch,
  timeoutMs = 30_000
): Promise<T> {
  const signal = init.signal ?? AbortSignal.timeout(timeoutMs);
  const response = await fetchImplementation(url, { ...init, signal });
  const text = await response.text();
  let payload: unknown;
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = { message: text }; }
  if (!response.ok) {
    const message = typeof (payload as { message?: unknown }).message === "string"
      ? (payload as { message: string }).message
      : response.statusText;
    throw new Error(`API request failed (${response.status}): ${message}`);
  }
  return payload as T;
}
