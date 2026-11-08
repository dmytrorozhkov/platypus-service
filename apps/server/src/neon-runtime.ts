import type { PoolConfig } from 'pg';
import {
  createNeonConnection,
  readNeonConfiguration,
  type NeonConnection,
} from './neon-connection.js';
import {
  createPostgresRuntime,
  type PostgresRuntime,
  type SignalSource,
} from './postgres-runtime.js';
import { allowedOriginsFromEnvironment } from './ticket-application.js';
import type { TicketQueryable } from './postgres-ticket-repository.js';

export interface NeonRuntimeConfiguration {
  environment: NodeJS.ProcessEnv;
  database: PoolConfig;
  port: number;
  allowedOrigins: readonly string[];
}

const invalid = () => new Error('Invalid explicit Neon runtime configuration.');
const unavailable = () => new Error('Neon runtime could not start.');

export function readNeonRuntimeConfiguration(
  environment: NodeJS.ProcessEnv,
): NeonRuntimeConfiguration {
  try {
    const database = readNeonConfiguration(environment);
    if (
      environment['NEON_DATABASE'] !== 'neondb' ||
      environment['NEON_USER'] !== 'platypus_app' ||
      !/^ep-[a-z0-9]+(?:-[a-z0-9]+)*-pooler\.(?:c-[1-9][0-9]*\.)?eu-central-1\.aws\.neon\.tech$/.test(
        String(database.host),
      ) ||
      environment['NEON_CONFIRM_TARGET'] !== `${database.host}/neondb`
    )
      throw invalid();
    const port = environment['PORT'] ?? '3002';
    if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
      throw invalid();
    return {
      environment: {
        NEON_HOST: environment['NEON_HOST'],
        NEON_DATABASE: 'neondb',
        NEON_USER: 'platypus_app',
        NEON_PASSWORD: environment['NEON_PASSWORD'],
      },
      database,
      port: Number(port),
      allowedOrigins: allowedOriginsFromEnvironment(
        environment['ALLOWED_ORIGINS'] ?? 'http://localhost:5177',
      ),
    };
  } catch {
    throw invalid();
  }
}

// One transaction through the reviewed adapter. Missing schema/tables fail closed.
export const neonProbeSql = `
SELECT current_setting('server_version_num') AS version_num,
       current_setting('server_encoding') AS encoding,
       current_setting('transaction_read_only') AS read_only,
       current_database() AS database_name, current_user AS database_user,
       session_user AS session_user_name,
       r.rolcanlogin AS can_login, r.rolsuper AS superuser,
       r.rolcreatedb AS create_database, r.rolcreaterole AS create_role,
       r.rolreplication AS replication, r.rolbypassrls AS bypass_rls,
       r.rolinherit AS inherit,
       EXISTS (SELECT 1 FROM pg_auth_members m WHERE m.member = r.oid) AS has_memberships,
       EXISTS (SELECT 1 FROM pg_database d WHERE d.datname = current_database() AND d.datdba = r.oid) AS owns_database,
       EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspowner = r.oid) AS owns_schema,
       EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
               WHERE n.nspname = 'platypus' AND c.relname IN ('organizations','support_agents','tickets')
                 AND c.relowner = r.oid) AS owns_business_table,
       has_schema_privilege(current_user, 'platypus', 'USAGE') AS schema_usage,
       has_schema_privilege(current_user, 'platypus', 'CREATE') AS schema_create,
       has_database_privilege(current_user, current_database(), 'CREATE') AS database_create,
       (SELECT bool_and(has_table_privilege(current_user, name, 'SELECT')) FROM
         unnest(ARRAY['platypus.organizations','platypus.support_agents','platypus.tickets']) name) AS business_select,
       (SELECT bool_or(has_table_privilege(current_user, name, privilege)
                      OR has_any_column_privilege(current_user, name, 'INSERT,UPDATE,REFERENCES')) FROM
         unnest(ARRAY['platypus.organizations','platypus.support_agents','platypus.tickets']) name
         CROSS JOIN unnest(ARRAY['INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege) AS business_write
FROM pg_roles r WHERE r.rolname = current_user`;

export interface NeonProbeResult {
  versionMajor: 18;
  database: 'neondb';
  user: 'platypus_app';
  readOnly: true;
}

export async function probeNeonConnection(
  connection: TicketQueryable,
): Promise<NeonProbeResult> {
  try {
    const { rows } = await connection.query(neonProbeSql);
    const row = rows[0];
    if (
      rows.length !== 1 ||
      !row ||
      !/^18\d{4}$/.test(String(row['version_num'])) ||
      row['encoding'] !== 'UTF8' ||
      row['read_only'] !== 'on' ||
      row['database_name'] !== 'neondb' ||
      row['database_user'] !== 'platypus_app' ||
      row['session_user_name'] !== 'platypus_app' ||
      ['can_login', 'schema_usage', 'business_select'].some(
        (key) => row[key] !== true,
      ) ||
      [
        'superuser',
        'create_database',
        'create_role',
        'replication',
        'bypass_rls',
        'inherit',
        'has_memberships',
        'owns_database',
        'owns_schema',
        'owns_business_table',
        'schema_create',
        'database_create',
        'business_write',
      ].some((key) => row[key] !== false)
    )
      throw unavailable();
    return {
      versionMajor: 18,
      database: 'neondb',
      user: 'platypus_app',
      readOnly: true,
    };
  } catch {
    throw new Error('Neon connection identity or permissions check failed.');
  }
}

export function createNeonRuntime({
  configuration,
  connection = createNeonConnection({ environment: configuration.environment }),
  signals = process,
  log = (message: string) => console.error(message),
  onShutdownFailure = () => {},
  onStopped = () => {},
  httpDrainMillis = 20000,
  poolDrainMillis = 4000,
}: {
  configuration: NeonRuntimeConfiguration;
  connection?: NeonConnection;
  signals?: SignalSource;
  log?: (message: string) => void;
  onShutdownFailure?: () => void;
  onStopped?: () => void;
  httpDrainMillis?: number;
  poolDrainMillis?: number;
}): PostgresRuntime {
  const report = (message: string) => {
    try {
      log(message);
    } catch {
      /* Diagnostics do not own cleanup. */
    }
  };
  let stopping: Promise<void> | undefined;
  let starting: Promise<void> | undefined;
  let cancelStartup: () => void = () => {};
  const removeSignals = () => {
    signals.removeListener('SIGINT', onSignal);
    signals.removeListener('SIGTERM', onSignal);
  };
  // The Neon adapter owns driver errors and connection cleanup; no second pool exists.
  const runtime = createPostgresRuntime({
    configuration,
    pool: {
      query: (text, values) => connection.query(text, values),
      end: () => connection.close(),
      on: () => {},
      removeListener: () => {},
    },
    signals: { on: () => {}, removeListener: () => {} },
    log: () => report('Neon ticket request failed.'),
    httpDrainMillis,
    poolDrainMillis,
    onStopped: () => {
      removeSignals();
      onStopped();
    },
  });
  const stop = () => {
    if (stopping) return stopping;
    stopping = runtime.stop().catch(() => {
      throw new Error('Neon runtime cleanup failed.');
    });
    cancelStartup();
    return stopping;
  };
  function onSignal() {
    void stop().catch(() => {
      report('Neon runtime cleanup failed.');
      onShutdownFailure();
    });
  }
  return {
    server: runtime.server,
    get stopping() {
      return stopping !== undefined;
    },
    start() {
      if (starting) return starting;
      if (stopping) return Promise.reject(unavailable());
      signals.on('SIGINT', onSignal);
      signals.on('SIGTERM', onSignal);
      starting = (async () => {
        try {
          await Promise.race([
            probeNeonConnection(connection),
            new Promise<never>((_resolve, reject) => {
              cancelStartup = () => reject(unavailable());
            }),
          ]);
          if (stopping) throw unavailable();
          await runtime.start();
          if (stopping) throw unavailable();
        } catch {
          try {
            await stop();
          } catch {
            report('Neon runtime cleanup failed.');
          }
          throw unavailable();
        }
      })();
      return starting;
    },
    stop,
  };
}
