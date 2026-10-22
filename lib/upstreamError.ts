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

  constructor(status: number, url: string, options: { code?: string; message?: string; retryAfterMs?: number } = {}) {
    super(`${status} ${url}${options.message ? ` — ${options.message}` : ''}`);
    this.name = 'UpstreamError';
    this.status = status;
    this.url = url;
    this.code = options.code;
    this.providerMessage = options.message;
    this.retryAfterMs = options.retryAfterMs;
  }

  /** Server failures, network errors and rate limits may succeed if retried; other 4xx and parse failures will not. */
  get retryable() {
    return this.code !== 'UNEXPECTED_FORMAT' && (this.status >= 500 || this.status === 0 || this.status === 429);
  }

  /** Message safe to show to end users (pt-BR, matching the UI). */
  get userMessage() {
    if (this.code === 'UNEXPECTED_FORMAT') return 'O Investidor10 respondeu em um formato inesperado; o site pode ter mudado.';
    if (this.status === 0) return 'Não foi possível conectar ao Investidor10.';
    if (this.status === 404) return 'O Investidor10 não encontrou os dados solicitados.';
    if (this.status === 403) return 'O Investidor10 recusou o acesso (bloqueio anti-robô).';
    if (this.status === 429) return 'O Investidor10 está em manutenção ou limitou o número de requisições. Tente novamente mais tarde.';
    if (this.status >= 500) return 'O Investidor10 está indisponível no momento. Tente novamente mais tarde.';
    return `O Investidor10 recusou a requisição (HTTP ${this.status}).`;
  }
}

export const isUpstreamError = (error: unknown): error is UpstreamError => error instanceof UpstreamError;
