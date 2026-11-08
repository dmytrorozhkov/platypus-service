import { checkServerIdentity } from 'node:tls';
import { Client } from 'pg';
import { readNeonConfiguration } from '../../dist/neon-connection.js';

const failure = () => new Error('Migration connection or operation failed.');
const maximumOperationMillis = 360000;

export async function assertMigrationIdentity(client, configuration) {
  const identity = (
    await client.query(`SELECT current_database() AS database,
    session_user AS username, current_setting('server_version_num')::integer AS version,
    current_setting('server_encoding') AS encoding`)
  ).rows[0];
  if (
    identity?.database !== configuration.database ||
    identity?.username !== configuration.user ||
    Math.trunc(Number(identity?.version) / 10000) !== 18 ||
    identity?.encoding !== 'UTF8'
  )
    throw failure();
}

export function migrationConfiguration(operation, environment) {
  if (!['export', 'import', 'verify'].includes(operation)) throw failure();
  // Reuse strict field validation and driver environment neutralization.
  const source = operation === 'export';
  const host = source
    ? 'ep-validation-pooler.eu-central-1.aws.neon.tech'
    : environment.NEON_MIGRATION_HOST;
  if (
    !source &&
    (typeof host !== 'string' ||
      !/^ep-[a-z0-9]+(?:-[a-z0-9]+)*\.(?:c-[1-9][0-9]*\.)?eu-central-1\.aws\.neon\.tech$/.test(
        host,
      ) ||
      host.split('.')[0].endsWith('-pooler') ||
      environment.NEON_MIGRATION_CONFIRM_TARGET !== `${host}/neondb`)
  )
    throw failure();
  const configuration = readNeonConfiguration({
    NEON_HOST: source ? host : host.replace('.', '-pooler.'),
    NEON_DATABASE: source ? 'platypus_service_large' : 'neondb',
    NEON_USER: source ? 'platypus_app' : 'neondb_owner',
    NEON_PASSWORD: source
      ? environment.LOCAL_MIGRATION_PASSWORD
      : environment.NEON_MIGRATION_PASSWORD,
  });
  return {
    ...configuration,
    host: source ? '127.0.0.1' : host,
    ssl: source
      ? false
      : {
          rejectUnauthorized: true,
          minVersion: 'TLSv1.2',
          checkServerIdentity: (_name, certificate) =>
            checkServerIdentity(host, certificate),
        },
    application_name: `platypus-migration-${operation}`,
    query_timeout: 60000,
    statement_timeout: 45000,
    lock_timeout: 3000,
    idle_in_transaction_session_timeout: 60000,
  };
}

export async function withMigrationClient(
  configuration,
  work,
  {
    clientFactory = (config) => new Client(config),
    timeoutMillis = maximumOperationMillis,
    cleanupMillis = 3000,
  } = {},
) {
  if (
    !Number.isInteger(timeoutMillis) ||
    timeoutMillis < 1 ||
    timeoutMillis > maximumOperationMillis ||
    !Number.isInteger(cleanupMillis) ||
    cleanupMillis < 1 ||
    cleanupMillis > 3000
  )
    throw failure();
  let client;
  try {
    client = clientFactory(configuration);
  } catch {
    throw failure();
  }
  const destroyOwnedStream = () => {
    try {
      client.connection?.stream?.destroy();
    } catch {
      /* Best effort on this owned client only. */
    }
  };
  let ended;
  let aborted = false;
  const end = () => (ended ??= Promise.resolve().then(() => client.end()));
  let cancel;
  const cancellation = new Promise((_resolve, reject) => {
    cancel = reject;
  });
  const abort = () => {
    if (aborted) return;
    aborted = true;
    destroyOwnedStream();
    end().catch(() => {});
    cancel(failure());
  };
  client.on('error', abort);
  const timer = setTimeout(abort, timeoutMillis);
  const guard = () => {
    if (aborted) throw failure();
  };
  const ownedWork = (async () => {
    await client.connect();
    guard();
    return work({
      query: async (...args) => {
        guard();
        const result = await client.query(...args);
        guard();
        return result;
      },
    });
  })();
  let result;
  let failed = false;
  try {
    result = await Promise.race([ownedWork, cancellation]);
  } catch {
    failed = true;
  } finally {
    clearTimeout(timer);
    let cleanupTimer;
    try {
      await Promise.race([
        end(),
        new Promise((_resolve, reject) => {
          cleanupTimer = setTimeout(() => {
            aborted = true;
            destroyOwnedStream();
            reject(failure());
          }, cleanupMillis);
        }),
      ]);
    } catch {
      failed = true;
    } finally {
      clearTimeout(cleanupTimer);
    }
    // Keep the harmless error sink on this exclusively owned closed client.
    // Late connect/query/end settlements are observed by the raced promises.
  }
  if (failed) throw failure();
  return result;
}
