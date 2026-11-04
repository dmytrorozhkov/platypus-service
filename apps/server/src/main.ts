import { createTicketServer, defaultAllowedOrigins } from './server.js';
import { FixtureTicketRepository } from './ticket-repository.js';

try {
  const portText = process.env['PORT'] ?? '3000';
  if (
    !/^\d+$/.test(portText) ||
    Number(portText) < 1 ||
    Number(portText) > 65535
  )
    throw new Error('PORT must be an integer between 1 and 65535.');
  const port = Number(portText);
  const origins =
    process.env['ALLOWED_ORIGINS']?.split(',').map((value) => value.trim()) ??
    defaultAllowedOrigins;
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
  const server = createTicketServer({
    repository: new FixtureTicketRepository(),
    allowedOrigins: origins,
  });
  server.on('error', (failure: NodeJS.ErrnoException) => {
    console.error(
      'Ticket server could not start on localhost:' + port + '.',
      failure.code ?? failure.message,
    );
    process.exitCode = 1;
    process.disconnect?.();
  });
  server.listen(port, 'localhost', () => {
    console.log('Ticket server ready: http://localhost:' + port);
    process.send?.({ type: 'ready', port });
  });
  const stop = () => {
    server.close();
    server.closeAllConnections();
    process.disconnect?.();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
} catch (failure) {
  console.error(
    failure instanceof Error
      ? failure.message
      : 'Ticket server startup failed.',
  );
  process.exitCode = 1;
  process.disconnect?.();
}
