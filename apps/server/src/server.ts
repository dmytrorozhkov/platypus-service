import { createServer } from 'node:http';
import {
  createTicketApplication,
  type TicketApplicationOptions,
} from './ticket-application.js';

export { defaultAllowedOrigins } from './ticket-application.js';

export function createTicketServer(options: TicketApplicationOptions) {
  const application = createTicketApplication(options);
  return createServer(async (request, response) => {
    const rawUrl = request.url ?? '';
    const queryStart = rawUrl.indexOf('?');
    const result = await application({
      method: request.method ?? '',
      pathname: queryStart === -1 ? rawUrl : rawUrl.slice(0, queryStart),
      rawQuery: queryStart === -1 ? '' : rawUrl.slice(queryStart + 1),
      origin: request.headers.origin,
    });
    if (!response.destroyed) {
      response.writeHead(result.statusCode, result.headers);
      response.end(result.body);
    }
  });
}
