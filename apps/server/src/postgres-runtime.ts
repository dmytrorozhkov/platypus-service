import type { Server } from 'node:http';
import { Pool, type PoolConfig } from 'pg';
import { allowedOriginsFromEnvironment } from './ticket-application.js';
import {
  PostgresTicketRepository,
  type TicketQueryable,
} from './postgres-ticket-repository.js';
import { createTicketServer } from './server.js';

export interface PostgresConfiguration {
  database: PoolConfig;
  port: number;
  allowedOrigins: readonly string[];
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name];
  if (
    value === undefined ||
    value.length === 0 ||
    (name !== 'PGPASSWORD' && value.trim().length === 0)
  )
    throw new Error(`${name} must be explicitly configured.`);
  return value;
}

function port(value: string, name: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  return Number(value);
}

export function readPostgresConfiguration(
  environment: NodeJS.ProcessEnv,
): PostgresConfiguration {
  const host = required(environment, 'PGHOST');
  // This entry point is a local learning adapter, not cloud database configuration.
  if (!['127.0.0.1', 'localhost', '::1'].includes(host))
    throw new Error(
      'PGHOST must identify the explicitly configured local PostgreSQL instance.',
    );
  return {
    database: {
      host,
      port: port(required(environment, 'PGPORT'), 'PGPORT'),
      database: required(environment, 'PGDATABASE'),
      user: required(environment, 'PGUSER'),
      password: required(environment, 'PGPASSWORD'),
      ssl: false,
      options: '-c default_transaction_read_only=on',
      application_name: 'platypus-readonly-server',
      max: 5,
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10000,
      statement_timeout: 5000,
      query_timeout: 6000,
    },
    port: port(environment['PORT'] ?? '3000', 'PORT'),
    allowedOrigins: allowedOriginsFromEnvironment(
      environment['ALLOWED_ORIGINS'],
    ),
  };
}

export interface PostgresPool extends TicketQueryable {
  on(event: 'error', listener: (failure: unknown) => void): unknown;
  removeListener(event: 'error', listener: (failure: unknown) => void): unknown;
  end(): Promise<void>;
}

export interface SignalSource {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  removeListener(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

export type PostgresLog = (message: string, code: string) => void;

function errorCode(failure: unknown): string {
  if (typeof failure !== 'object' || failure === null || !('code' in failure))
    return 'UNKNOWN';
  return typeof failure.code === 'string' &&
    /^[A-Z0-9_]{1,32}$/.test(failure.code)
    ? failure.code
    : 'UNKNOWN';
}

async function bounded(
  operation: Promise<void>,
  milliseconds: number,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('PostgreSQL shutdown deadline exceeded.')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export interface PostgresRuntime {
  server: Server;
  start(): Promise<void>;
  stop(): Promise<void>;
  readonly stopping: boolean;
}

export function createPostgresRuntime({
  configuration,
  pool = new Pool(configuration.database),
  signals = process,
  log = (message, code) => console.error(message, code),
  onShutdownFailure = () => {},
  onStopped = () => {},
  httpDrainMillis = 5000,
  poolDrainMillis = 7000,
}: {
  configuration: PostgresConfiguration;
  pool?: PostgresPool;
  signals?: SignalSource;
  log?: PostgresLog;
  onShutdownFailure?: () => void;
  onStopped?: () => void;
  httpDrainMillis?: number;
  poolDrainMillis?: number;
}): PostgresRuntime {
  const reportPoolError = (failure: unknown) =>
    log('PostgreSQL pool operation failed.', errorCode(failure));
  pool.on('error', reportPoolError);
  const server = createTicketServer({
    repository: new PostgresTicketRepository(pool),
    allowedOrigins: configuration.allowedOrigins,
    logError: (failure) =>
      log('Ticket database request failed.', errorCode(failure)),
  });
  const listenController = new AbortController();
  let started = false;
  let stopPromise: Promise<void> | undefined;
  let startPromise: Promise<void> | undefined;
  server.on('request', (_request, response) => {
    response.once('finish', () => {
      if (stopPromise !== undefined) server.closeIdleConnections();
    });
  });
  const onSignal = () => {
    void stop().catch(() => {
      log('PostgreSQL server cleanup failed.', 'SHUTDOWN_FAILED');
      onShutdownFailure();
    });
  };
  function stop(): Promise<void> {
    if (stopPromise !== undefined) return stopPromise;
    stopPromise = (async () => {
      try {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(() => {
            server.closeAllConnections();
            resolve();
          }, httpDrainMillis);
          server.close(() => {
            clearTimeout(timer);
            resolve();
          });
          if (!started) listenController.abort();
          server.closeIdleConnections();
        });
        await bounded(
          Promise.resolve()
            .then(() => pool.end())
            .then(() => {
              pool.removeListener('error', reportPoolError);
            }),
          poolDrainMillis,
        );
      } finally {
        signals.removeListener('SIGINT', onSignal);
        signals.removeListener('SIGTERM', onSignal);
        onStopped();
      }
    })();
    return stopPromise;
  }
  return {
    server,
    get stopping() {
      return stopPromise !== undefined;
    },
    start() {
      if (startPromise !== undefined) return startPromise;
      if (stopPromise !== undefined)
        return Promise.reject(
          new Error('PostgreSQL server is already stopping.'),
        );
      signals.on('SIGINT', onSignal);
      signals.on('SIGTERM', onSignal);
      startPromise = new Promise<void>((resolve, reject) => {
        const onListen = () => {
          started = true;
          cleanup();
          resolve();
        };
        const onError = (failure: unknown) => {
          cleanup();
          reject(failure);
        };
        const onClose = () => {
          if (!started) {
            cleanup();
            reject(new Error('PostgreSQL server startup was interrupted.'));
          }
        };
        const cleanup = () => {
          server.removeListener('listening', onListen);
          server.removeListener('error', onError);
          server.removeListener('close', onClose);
        };
        server.once('listening', onListen);
        server.once('error', onError);
        server.once('close', onClose);
        try {
          server.listen({
            port: configuration.port,
            host: 'localhost',
            signal: listenController.signal,
          });
        } catch (failure) {
          onError(failure);
        }
      });
      return startPromise;
    },
    stop,
  };
}
