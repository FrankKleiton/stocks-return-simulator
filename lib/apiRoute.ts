import { NextResponse } from 'next/server';
import { isUpstreamError } from './upstreamError';

export type ApiErrorBody = { error: string; upstreamStatus?: number };

/** Thrown by route handlers for invalid client input; becomes a 400 response. */
export class BadRequestError extends Error {
  constructor(message: string) { super(message); this.name = 'BadRequestError'; }
}

/**
 * Runs a route handler and converts thrown errors into JSON error responses so the client
 * always receives a parseable body with a meaningful status code.
 */
export async function handleApiRequest<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    return NextResponse.json(await handler());
  } catch (error) {
    if (error instanceof BadRequestError || error instanceof SyntaxError) {
      return NextResponse.json<ApiErrorBody>({ error: error instanceof SyntaxError ? 'Corpo da requisição inválido' : error.message }, { status: 400 });
    }
    if (isUpstreamError(error)) {
      console.error(`[api] upstream failure: ${error.message}`);
      return NextResponse.json<ApiErrorBody>({ error: error.userMessage, upstreamStatus: error.status }, { status: 502 });
    }
    console.error('[api] unexpected failure', error);
    return NextResponse.json<ApiErrorBody>({ error: 'Erro interno ao processar a requisição.' }, { status: 500 });
  }
}
