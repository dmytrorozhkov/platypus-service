import { checkServerIdentity } from 'node:tls';
import { Pool, type PoolConfig } from 'pg';
import type { TicketQueryable } from './postgres-ticket-repository.js';

type Environment = Record<string, string | undefined>;
type Result = { rows: Record<string, unknown>[] };
interface NeonClient {
  query(text: string, values?: unknown[]): Promise<Result>;
  release(destroy?: boolean): void;
  on(event: 'error', listener: () => void): unknown;
  removeListener(event: 'error', listener: () => void): unknown;
}
interface NeonPool {
  connect(): Promise<NeonClient>;
  end(): Promise<void>;
  on(event: 'error', listener: () => void): unknown;
}
export interface NeonConnection extends TicketQueryable {
  close(): Promise<void>;
}
interface NeonConnectionOptions {
  environment: Environment;
  poolFactory?: (configuration: PoolConfig) => NeonPool;
  log?: (message: string) => void;
  // Test seams may shorten deadlines, never enlarge production budgets.
  operationTimeoutMillis?: number;
  closeTimeoutMillis?: number;
}

const operationLimit = 15000;
const closeLimit = 3000;
const unavailable = () => new Error('Neon database operation failed.');
const invalid = () =>
  new Error('Invalid explicit Neon connection configuration.');

export function readNeonConfiguration(environment: Environment): PoolConfig {
  const host = environment['NEON_HOST'];
  const database = environment['NEON_DATABASE'];
  const user = environment['NEON_USER'];
  const password = environment['NEON_PASSWORD'];
  // AWS pooled endpoints, including current optional regional routing labels.
  const pooledHost =
    /^ep-[a-z0-9]+(?:-[a-z0-9]+)*-pooler\.(?:c-[1-9][0-9]*\.)?[a-z]{2}(?:-[a-z]+)+-[1-9][0-9]*\.aws\.neon\.tech$/;
  if (
    typeof host !== 'string' ||
    host.length > 253 ||
    !pooledHost.test(host) ||
    host.split('.').some((label) => label.length > 63) ||
    typeof database !== 'string' ||
    !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(database) ||
    typeof user !== 'string' ||
    !/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(user) ||
    typeof password !== 'string' ||
    password.length === 0 ||
    password.length > 4096 ||
    [...password].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    /^\w+:\/\//.test(password)
  )
    throw invalid();
  const configuration: PoolConfig & { replication: string } = {
    host,
    database,
    user,
    password,
    port: 5432,
    ssl: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      checkServerIdentity: (_hostname, certificate) =>
        checkServerIdentity(host, certificate),
    },
    sslnegotiation: 'postgres',
    client_encoding: 'UTF8',
    replication: 'false',
    application_name: 'platypus-neon-readonly',
    // pg's val() treats an empty string as missing and would use PGOPTIONS.
    options: ' ',
    max: 2,
    min: 0,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 10000,
    maxLifetimeSeconds: 300,
    query_timeout: 6000,
    keepAlive: false,
    allowExitOnIdle: true,
  };
  return configuration;
}

function bounded(value: number | undefined, maximum: number): number {
  if (value === undefined) return maximum;
  if (!Number.isInteger(value) || value < 1 || value > maximum) throw invalid();
  return value;
}

export function createNeonConnection(
  options: NeonConnectionOptions,
): NeonConnection {
  const configuration = readNeonConfiguration(options.environment);
  const operationTimeout = bounded(
    options.operationTimeoutMillis,
    operationLimit,
  );
  const closeTimeout = bounded(options.closeTimeoutMillis, closeLimit);
  const log = (message: string) => {
    // Logging is diagnostic only and must not change ownership/cleanup.
    try {
      options.log?.(message);
    } catch {
      /* Ignore a failing diagnostic sink. */
    }
  };
  let pool: NeonPool;
  try {
    pool = options.poolFactory?.(configuration) ?? new Pool(configuration);
    // pg-pool has already removed/destroyed the idle client before this event.
    pool.on('error', () => log('Neon idle connection discarded.'));
  } catch {
    throw unavailable();
  }
  let closed = false;
  let closing: Promise<void> | undefined;
  const active = new Set<() => void>();

  return {
    async query(text, values) {
      // Bound queued operations as well as physical connections and timers.
      if (closed || active.size >= 2) throw unavailable();
      let client: NeonClient | undefined;
      let released = false;
      let aborted = false;
      let inTransaction = false;
      let rejectCancellation: (reason: Error) => void = () => {};
      const cancellation = new Promise<never>((_resolve, reject) => {
        rejectCancellation = reject;
      });
      const discard = (destroy: boolean) => {
        if (!client || released) return;
        released = true;
        try {
          client.release(destroy);
        } catch {
          log('Neon connection cleanup failed.');
        }
        client.removeListener('error', abort);
      };
      const abort = () => {
        if (aborted) return;
        aborted = true;
        discard(true);
        rejectCancellation(unavailable());
      };
      active.add(abort);
      const timer = setTimeout(abort, operationTimeout);
      const statement = async (sql: string, parameters?: unknown[]) => {
        if (aborted || closed || !client) throw unavailable();
        const result = await client.query(sql, parameters);
        if (aborted || closed) throw unavailable();
        return result;
      };
      const work = (async () => {
        try {
          client = await pool.connect();
          if (aborted || closed) {
            discard(true);
            throw unavailable();
          }
          client.on('error', abort);
          await statement('BEGIN READ ONLY');
          inTransaction = true;
          await statement("SET LOCAL statement_timeout = '5000ms'");
          await statement("SET LOCAL lock_timeout = '2000ms'");
          await statement(
            "SET LOCAL idle_in_transaction_session_timeout = '6000ms'",
          );
          const result = await statement(text, values);
          await statement('COMMIT');
          inTransaction = false;
          discard(false);
          return { rows: result.rows };
        } catch {
          if (inTransaction && !aborted && !closed) {
            try {
              await statement('ROLLBACK');
            } catch {
              /* Discard below, never replay SQL. */
            }
          }
          discard(true);
          throw unavailable();
        } finally {
          active.delete(abort);
        }
      })();
      try {
        return await Promise.race([work, cancellation]);
      } catch {
        log('Neon database operation failed.');
        throw unavailable();
      } finally {
        clearTimeout(timer);
      }
    },
    close() {
      if (closing) return closing;
      closed = true;
      for (const abort of active) abort();
      closing = (async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            Promise.resolve().then(() => pool.end()),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => reject(unavailable()), closeTimeout);
            }),
          ]);
        } catch {
          log('Neon connection cleanup failed.');
          throw new Error('Neon connection cleanup failed.');
        } finally {
          clearTimeout(timer);
        }
      })();
      return closing;
    },
  };
}
