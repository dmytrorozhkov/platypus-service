import { createServer } from 'node:http';
import {
  createTicketApplication,
  type TicketApplicationOptions,
} from './ticket-application.js';

export { defaultAllowedOrigins } from './ticket-application.js';

export function createTicketServer(options: TicketApplicationOptions) {
  const application = createTicketApplication(options);
  return createServer(async (request, response) => {
    const result = await application({
      method: request.method ?? '',
      pathname: (request.url ?? '').split('?')[0],
      origin: request.headers.origin,
    });
    if (!response.destroyed) {
      response.writeHead(result.statusCode, result.headers);
      response.end(result.body);
    }
  });
}
