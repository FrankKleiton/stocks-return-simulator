/** Error thrown by fetchJson when the API responds with a non-OK status. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string, readonly upstreamStatus?: number) { super(message); this.name = 'ApiError'; }
  /** The data provider has no such ticker (as opposed to being unreachable). */
  get notFound() { return this.status === 404 || this.upstreamStatus === 404; }
}

const fallbackMessage = 'Não foi possível carregar os dados. Tente novamente mais tarde.';

/** Fetches JSON from an internal API route, turning error responses into an ApiError with the server's message. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  if (!response.ok) {
    const errorBody = typeof body === 'object' && body ? body as { error?: unknown; upstreamStatus?: unknown } : {};
    const serverMessage = typeof errorBody.error === 'string' ? errorBody.error : undefined;
    const upstreamStatus = typeof errorBody.upstreamStatus === 'number' ? errorBody.upstreamStatus : undefined;
    throw new ApiError(response.status, serverMessage || `${fallbackMessage} (HTTP ${response.status})`, upstreamStatus);
  }
  if (body === undefined) throw new ApiError(response.status, `${fallbackMessage} (resposta vazia)`);
  return body as T;
}

export const errorMessage = (error: unknown) => error instanceof Error && error.message ? error.message : fallbackMessage;
