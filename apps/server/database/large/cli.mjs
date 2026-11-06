import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  explicitConnectionFromEnvironment,
  migrate,
} from '../migrate-seed.mjs';
import {
  assertLargeTarget,
  LargeSetupError,
  seedLarge,
  verifyLarge,
} from './seed-large.mjs';

async function main() {
  const operation = process.argv[2];
  if (
    process.argv.length !== 3 ||
    !['migrate', 'seed', 'check'].includes(operation)
  )
    throw new LargeSetupError(
      'Choose exactly one explicit large operation: migrate, seed or check.',
    );
  const configuration = explicitConnectionFromEnvironment();
  if (!['127.0.0.1', 'localhost', '::1'].includes(configuration.host))
    throw new LargeSetupError(
      'Large setup is limited to explicit loopback database hosts.',
    );
  if (
    !['platypus_service_large', 'platypus_service_large_test'].includes(
      configuration.database,
    )
  )
    throw new LargeSetupError(
      'Only the explicitly named large project databases are allowed.',
    );
  const { Pool } = await import('pg');
  const pool = new Pool(configuration);
  pool.on('error', () =>
    console.error('Large database setup connection failed.'),
  );
  try {
    const client = await pool.connect();
    try {
      await assertLargeTarget(client);
    } finally {
      client.release();
    }
    console.log(
      JSON.stringify(
        await { migrate, seed: seedLarge, check: verifyLarge }[operation](pool),
      ),
    );
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      'Large database setup failed.',
      error instanceof LargeSetupError
        ? error.message
        : /^[A-Z0-9]{5}$/.test(error?.code)
          ? error.code
          : 'Check explicit configuration and expected schema.',
    );
    process.exitCode = 1;
  });
}
