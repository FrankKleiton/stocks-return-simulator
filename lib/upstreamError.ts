/** Error raised when the upstream data provider (Status Invest) cannot serve a request. */
export class UpstreamError extends Error {
  readonly status: number;
  readonly url: string;
  readonly challenge: boolean;

  constructor(status: number, url: string, options: { challenge?: boolean } = {}) {
    super(`${status} ${url}`);
    this.name = 'UpstreamError';
    this.status = status;
    this.url = url;
    this.challenge = options.challenge ?? false;
  }

  /** 4xx responses (blocked, not found, rate limited) will not succeed if retried immediately. */
  get retryable() {
    return this.status >= 500 || this.status === 0;
  }

  /** Message safe to show to end users (pt-BR, matching the UI). */
  get userMessage() {
    if (this.challenge) return 'O Status Invest está bloqueando as requisições com uma verificação do Cloudflare. Tente novamente mais tarde.';
    if (this.status === 429) return 'O Status Invest limitou o número de requisições. Aguarde alguns minutos e tente novamente.';
    if (this.status === 404) return 'O Status Invest não encontrou os dados solicitados.';
    if (this.status >= 500) return 'O Status Invest está indisponível no momento. Tente novamente mais tarde.';
    return `O Status Invest recusou a requisição (HTTP ${this.status}).`;
  }
}

export const isUpstreamError = (error: unknown): error is UpstreamError => error instanceof UpstreamError;
