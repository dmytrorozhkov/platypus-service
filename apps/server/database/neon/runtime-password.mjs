import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { escapeLiteral } from 'pg';
import {
  migrationConfiguration,
  assertMigrationIdentity,
  withMigrationClient,
} from './connection.mjs';

const guardSha256 =
  '3c830dc8592ff72f83d390819a81f57e96576110169fc9ba06797f31563d3648';
const failed = () =>
  new Error('Runtime password setup failed. No automatic retry was attempted.');
const uncertain = () =>
  new Error(
    'Runtime password commit outcome is uncertain. Run the app connection check before an explicit retry. No automatic retry was attempted.',
  );

async function reviewedGuard() {
  const source = (
    await readFile(
      new URL('./activate-runtime-role.sql', import.meta.url),
      'utf8',
    )
  ).replaceAll('\r\n', '\n');
  const match =
    /^(?:--[^\n]*\n)*BEGIN;\n(DO \$guard\$\n[\s\S]+?\n\$guard\$;)\nALTER ROLE platypus_app LOGIN;\nCOMMIT;\n?$/.exec(
      source,
    );
  if (
    !match ||
    createHash('sha256').update(match[1]).digest('hex') !== guardSha256
  )
    throw failed();
  return match[1];
}

export async function setRuntimePassword({
  environment = process.env,
  runClient = withMigrationClient,
} = {}) {
  let commitAttempted = false;
  try {
    // Validate the distinct app value before opening any connection. No password is
    // generated, printed, hashed for receipts or accepted from command arguments.
    const password = environment.NEON_APP_NEW_PASSWORD;
    if (
      typeof password !== 'string' ||
      password.length < 20 ||
      password.length > 128 ||
      [...password].some(
        (character) =>
          character.charCodeAt(0) < 32 || character.charCodeAt(0) > 126,
      ) ||
      password === environment.NEON_MIGRATION_PASSWORD
    )
      throw failed();
    const configuration = {
      ...migrationConfiguration('import', environment),
      application_name: 'platypus-runtime-password',
      query_timeout: 15000,
      statement_timeout: 10000,
      lock_timeout: 3000,
      idle_in_transaction_session_timeout: 15000,
    };
    // No input-selected file or SQL. Reuse the exact reviewed effective-role guard
    // and reject structural drift instead of silently weakening its predicates.
    const guard = await reviewedGuard();
    await runClient(
      configuration,
      async (client) => {
        await assertMigrationIdentity(client, configuration);
        let inTransaction = false;
        try {
          await client.query('BEGIN');
          inTransaction = true;
          await client.query("SET LOCAL password_encryption = 'scram-sha-256'");
          await client.query(guard);
          const login = await client.query(
            "SELECT rolcanlogin FROM pg_roles WHERE rolname = 'platypus_app'",
          );
          if (login.rows.length !== 1 || login.rows[0]?.rolcanlogin !== true)
            throw failed();
          // PostgreSQL utility statements do not accept a $1 password parameter.
          // pg.escapeLiteral safely quotes quotes/backslashes; the role is fixed.
          await client.query(
            'ALTER ROLE platypus_app PASSWORD ' + escapeLiteral(password),
          );
          commitAttempted = true;
          await client.query('COMMIT');
          inTransaction = false;
        } catch {
          // After COMMIT was sent, its response cannot establish whether the change
          // committed. Do not promise rollback or automatically replay the password.
          if (inTransaction && !commitAttempted) {
            try {
              await client.query('ROLLBACK');
            } catch {
              /* Owned bounded cleanup follows. */
            }
          }
          throw failed();
        }
      },
      { timeoutMillis: 60000, cleanupMillis: 3000 },
    );
    return {
      operation: 'set-runtime-password',
      role: 'platypus_app',
      database: 'neondb',
      passwordConfigured: true,
    };
  } catch {
    throw commitAttempted ? uncertain() : failed();
  }
}

// Import-only use has no SQL, prompt, credential read or network side effects.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.argv.length !== 3 || process.argv[2] !== 'set') {
    console.error(
      'Choose runtime-password.mjs set without additional arguments.',
    );
    process.exitCode = 1;
  } else {
    setRuntimePassword().then(
      (result) => console.log(JSON.stringify(result)),
      (failure) => {
        console.error(failure.message);
        process.exitCode = 1;
      },
    );
  }
}
