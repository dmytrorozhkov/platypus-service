import {
  allowedOriginsFromEnvironment,
  createTicketApplication,
  isTicketPath,
  ticketError,
  type TicketApplicationOptions,
  type TicketRequest,
  type TicketResponse,
} from './ticket-application.js';
import { FixtureTicketRepository } from './ticket-repository.js';

export interface FunctionUrlResponse extends TicketResponse {
  isBase64Encoded: false;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Consume only the documented payload-v2 routing fields; never default a malformed event to GET.
function fromFunctionUrl(event: unknown): TicketRequest | undefined {
  if (
    !record(event) ||
    event['version'] !== '2.0' ||
    typeof event['rawPath'] !== 'string' ||
    !record(event['requestContext']) ||
    !record(event['requestContext']['http']) ||
    typeof event['requestContext']['http']['method'] !== 'string'
  )
    return undefined;
  const method = event['requestContext']['http']['method'];
  if (
    !/^[!#$%&'*+.^_\x60|~0-9A-Za-z-]+$/.test(method) ||
    !isTicketPath(event['rawPath'])
  )
    return undefined;
  const headers = event['headers'];
  if (headers !== undefined && !record(headers)) return undefined;
  let origin: string | undefined;
  for (const [name, value] of Object.entries(headers ?? {})) {
    if (
      !/^[!#$%&'*+.^_\x60|~0-9A-Za-z-]+$/.test(name) ||
      typeof value !== 'string' ||
      /[\r\n]/.test(value)
    )
      return undefined;
    if (name.toLowerCase() === 'origin') {
      if (origin !== undefined) return undefined;
      origin = value.trim();
    }
  }
  return { method: method.toUpperCase(), pathname: event['rawPath'], origin };
}

export function createLambdaHandler(options: TicketApplicationOptions) {
  const application = createTicketApplication(options);
  return async (event: unknown): Promise<FunctionUrlResponse> => {
    const request = fromFunctionUrl(event);
    const response = request
      ? await application(request)
      : ticketError(
          400,
          'INVALID_REQUEST',
          'A valid Function URL payload v2 request is required.',
        );
    return { ...response, isBase64Encoded: false };
  };
}

const repository = new FixtureTicketRepository();
export async function handler(event: unknown): Promise<FunctionUrlResponse> {
  let allowedOrigins: readonly string[];
  try {
    allowedOrigins = allowedOriginsFromEnvironment(
      process.env['ALLOWED_ORIGINS'],
    );
  } catch {
    // Configuration values are deployment input; omit their details from the public response.
    console.error('Ticket server origin configuration is invalid.');
    return {
      ...ticketError(500, 'INTERNAL_ERROR', 'Tickets could not be loaded.'),
      isBase64Encoded: false,
    };
  }
  return createLambdaHandler({ repository, allowedOrigins })(event);
}
