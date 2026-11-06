import type { TicketRepository } from './ticket-repository.js';
import { InvalidTicketQuery, parseTicketQuery } from './ticket-query.js';

export const defaultAllowedOrigins = [
  'http://localhost:4200',
  'http://localhost:5175',
];

export interface TicketRequest {
  method: string;
  pathname: string;
  origin?: string;
  rawQuery?: string;
}
export interface TicketResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
export interface TicketApplicationOptions {
  repository: TicketRepository;
  allowedOrigins?: readonly string[];
  logError?: (failure: unknown) => void;
}

export function isTicketPath(pathname: string): boolean {
  return (
    pathname.startsWith('/') &&
    !/[\s?#]/.test(pathname) &&
    ![...pathname].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

export function allowedOriginsFromEnvironment(
  value?: string,
): readonly string[] {
  const origins =
    value?.split(',').map((origin) => origin.trim()) ?? defaultAllowedOrigins;
  for (const origin of origins) {
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.origin !== origin
    )
      throw new Error(
        'ALLOWED_ORIGINS must contain comma-separated HTTP origins.',
      );
  }
  return origins;
}

export function ticketResponse(
  statusCode: number,
  body?: unknown,
  headers: Record<string, string> = {},
): TicketResponse {
  return {
    statusCode,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      vary: 'Origin',
      ...(body === undefined
        ? {}
        : { 'content-type': 'application/json; charset=utf-8' }),
      ...headers,
    },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

export function ticketError(
  statusCode: number,
  code: string,
  message: string,
): TicketResponse {
  return ticketResponse(statusCode, { error: { code, message } });
}

export function createTicketApplication({
  repository,
  allowedOrigins = defaultAllowedOrigins,
  logError = (failure: unknown) =>
    console.error('Ticket request failed.', failure),
}: TicketApplicationOptions) {
  async function route(request: TicketRequest): Promise<TicketResponse> {
    const { method, pathname, origin } = request;
    if (
      !method ||
      !/^[!#$%&'*+.^_\x60|~0-9A-Z-]+$/.test(method) ||
      !isTicketPath(pathname)
    )
      return ticketError(400, 'INVALID_REQUEST', 'The request is invalid.');
    const cors: Record<string, string> =
      origin && allowedOrigins.includes(origin)
        ? { 'access-control-allow-origin': origin }
        : {};
    const respond = (
      statusCode: number,
      body?: unknown,
      headers: Record<string, string> = {},
    ) => ticketResponse(statusCode, body, { ...cors, ...headers });
    const error = (
      statusCode: number,
      code: string,
      message: string,
      headers?: Record<string, string>,
    ) => respond(statusCode, { error: { code, message } }, headers);
    if (origin && !allowedOrigins.includes(origin))
      return error(
        403,
        'ORIGIN_NOT_ALLOWED',
        'This browser origin is not allowed.',
      );
    const queryPath =
      pathname === '/api/tickets/query' &&
      typeof repository.query === 'function';
    const optionsPath =
      pathname === '/api/tickets/options' &&
      typeof repository.options === 'function';
    if (
      !['/api/health', '/api/tickets'].includes(pathname) &&
      !queryPath &&
      !optionsPath
    )
      return error(404, 'NOT_FOUND', 'This endpoint does not exist.');
    if (method === 'OPTIONS')
      return respond(204, undefined, {
        'access-control-allow-methods': 'GET, OPTIONS',
      });
    if (method !== 'GET')
      return error(405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint.', {
        allow: 'GET, OPTIONS',
      });
    try {
      if (queryPath)
        return respond(
          200,
          await repository.query!(parseTicketQuery(request.rawQuery)),
        );
      if (optionsPath) {
        if (request.rawQuery) throw new InvalidTicketQuery();
        return respond(200, await repository.options!());
      }
      return pathname === '/api/health'
        ? respond(200, { status: 'ok' })
        : respond(200, await repository.list());
    } catch (failure) {
      if (failure instanceof InvalidTicketQuery)
        return error(400, 'INVALID_REQUEST', 'The ticket query is invalid.');
      logError(failure);
      return error(500, 'INTERNAL_ERROR', 'Tickets could not be loaded.');
    }
  }
  return async (request: TicketRequest): Promise<TicketResponse> => {
    const response = await route(request);
    // Node HTTP suppresses HEAD bodies; the event transport must do so explicitly.
    return request.method === 'HEAD' ? { ...response, body: '' } : response;
  };
}
