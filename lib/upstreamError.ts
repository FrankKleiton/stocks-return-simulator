/** Error raised when the upstream data provider (Investidor10) cannot serve a request. */
export class UpstreamError extends Error {
  readonly status: number;
  readonly url: string;
  /** Machine-readable reason when the failure is not an HTTP status (e.g. UNEXPECTED_FORMAT when the page layout changed). */
  readonly code?: string;
  /** Extra detail from the provider or the parser, when any. */
  readonly providerMessage?: string;
  /** Delay suggested by the provider (Retry-After) before retrying. */
  readonly retryAfterMs?: number;
  /** Name shown to users; Investidor10 unless the failing provider says otherwise (e.g. the Central Bank for exchange rates). */
  readonly provider: string;

  constructor(status: number, url: string, options: { code?: string; message?: string; retryAfterMs?: number; provider?: string } = {}) {
    super(`${status} ${url}${options.message ? ` — ${options.message}` : ''}`);
    this.name = 'UpstreamError';
    this.status = status;
    this.url = url;
    this.code = options.code;
    this.providerMessage = options.message;
    this.retryAfterMs = options.retryAfterMs;
    this.provider = options.provider ?? 'Investidor10';
  }

  /** Server failures, network errors and rate limits may succeed if retried; other 4xx and parse failures will not. */
  get retryable() {
    return this.code !== 'UNEXPECTED_FORMAT' && (this.status >= 500 || this.status === 0 || this.status === 429);
  }

  /** Message safe to show to end users (pt-BR, matching the UI). */
  get userMessage() {
    const who = `O ${this.provider}`;
    if (this.code === 'UNEXPECTED_FORMAT') return `${who} respondeu em um formato inesperado; o site pode ter mudado.`;
    if (this.status === 0) return `Não foi possível conectar ao ${this.provider}.`;
    if (this.status === 404) return `${who} não encontrou os dados solicitados.`;
    if (this.status === 403) return `${who} recusou o acesso (bloqueio anti-robô).`;
    if (this.status === 429) return `${who} está em manutenção ou limitou o número de requisições. Tente novamente mais tarde.`;
    if (this.status >= 500) return `${who} está indisponível no momento. Tente novamente mais tarde.`;
    return `${who} recusou a requisição (HTTP ${this.status}).`;
  }
}

export const isUpstreamError = (error: unknown): error is UpstreamError => error instanceof UpstreamError;
