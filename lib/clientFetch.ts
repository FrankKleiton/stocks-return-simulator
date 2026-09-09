/** Error thrown by fetchJson when the API responds with a non-OK status. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); this.name = 'ApiError'; }
}

const fallbackMessage = 'Não foi possível carregar os dados. Tente novamente mais tarde.';

/** Fetches JSON from an internal API route, turning error responses into an ApiError with the server's message. */
export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  let body: unknown = undefined;
  try { body = text ? JSON.parse(text) : undefined; } catch { body = undefined; }
  if (!response.ok) {
    const serverMessage = typeof body === 'object' && body && 'error' in body && typeof (body as { error: unknown }).error === 'string' ? (body as { error: string }).error : undefined;
    throw new ApiError(response.status, serverMessage || `${fallbackMessage} (HTTP ${response.status})`);
  }
  if (body === undefined) throw new ApiError(response.status, `${fallbackMessage} (resposta vazia)`);
  return body as T;
}

export const errorMessage = (error: unknown) => error instanceof Error && error.message ? error.message : fallbackMessage;
