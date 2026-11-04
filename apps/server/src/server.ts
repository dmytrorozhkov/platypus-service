import { createServer, type ServerResponse } from 'node:http';
import type { TicketRepository } from './ticket-repository.js';

export const defaultAllowedOrigins = [
  'http://localhost:4200',
  'http://localhost:5175',
];

function json(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  response.end(JSON.stringify(body));
}
function error(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
) {
  json(response, status, { error: { code, message } });
}

export function createTicketServer({
  repository,
  allowedOrigins = defaultAllowedOrigins,
  logError = (failure: unknown) =>
    console.error('Ticket request failed.', failure),
}: {
  repository: TicketRepository;
  allowedOrigins?: readonly string[];
  logError?: (failure: unknown) => void;
}) {
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Vary', 'Origin');
    const origin = request.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin);
    }
    if (origin && !allowedOrigins.includes(origin)) {
      error(
        response,
        403,
        'ORIGIN_NOT_ALLOWED',
        'This browser origin is not allowed.',
      );
      return;
    }
    const pathname = (request.url ?? '/').split('?')[0];
    if (!['/api/health', '/api/tickets'].includes(pathname)) {
      error(response, 404, 'NOT_FOUND', 'This endpoint does not exist.');
      return;
    }
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.writeHead(204).end();
      return;
    }
    if (request.method !== 'GET') {
      response.setHeader('Allow', 'GET, OPTIONS');
      error(response, 405, 'METHOD_NOT_ALLOWED', 'Use GET for this endpoint.');
      return;
    }
    try {
      if (pathname === '/api/health') json(response, 200, { status: 'ok' });
      else {
        const collection = await repository.list();
        if (!response.destroyed) json(response, 200, collection);
      }
    } catch (failure) {
      logError(failure);
      if (!response.destroyed)
        error(response, 500, 'INTERNAL_ERROR', 'Tickets could not be loaded.');
    }
  });
}
