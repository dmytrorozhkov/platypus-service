import assert from 'node:assert/strict';
import pg from 'pg';
import {
  explicitConnectionFromEnvironment,
  migrate,
} from '../apps/server/database/migrate-seed.mjs';

assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.PLATYPUS_PG_TEST_OWNED, '1');
assert.equal(process.env.PGDATABASE, 'platypus_service_test');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.equal(process.env.PG_TEST_APP_USER, 'platypus_app_test');
const configuration = explicitConnectionFromEnvironment();
const source = new pg.Pool({ ...configuration, max: 1 });
try {
  assert.equal(
    (await source.query('SELECT current_database() AS name')).rows[0].name,
    'platypus_service_test',
  );
  assert.deepEqual(
    (await source.query('SELECT marker FROM public.platypus_test_ownership'))
      .rows,
    [{ marker: 'platypus-service-disposable-tests' }],
  );
  assert.equal(
    (
      await source.query(
        "SELECT count(*)::int AS count FROM pg_database WHERE datname='platypus_service_large_test'",
      )
    ).rows[0].count,
    0,
    'Large test database must be freshly created, never adopted/reset',
  );
  await source.query('CREATE DATABASE platypus_service_large_test');
  await source.query(
    'REVOKE ALL ON DATABASE platypus_service_large_test FROM PUBLIC',
  );
  await source.query(
    'GRANT CONNECT ON DATABASE platypus_service_large_test TO platypus_app_test',
  );
} finally {
  await source.end();
}
const large = new pg.Pool({
  ...configuration,
  database: 'platypus_service_large_test',
  max: 1,
});
try {
  assert.equal(
    (await large.query('SELECT current_database() AS name')).rows[0].name,
    'platypus_service_large_test',
  );
  await large.query('BEGIN');
  await large.query(
    'CREATE TABLE public.platypus_test_ownership(marker text PRIMARY KEY)',
  );
  await large.query(
    "INSERT INTO public.platypus_test_ownership VALUES ('platypus-service-large-disposable-tests')",
  );
  await large.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await large.query('COMMIT');
  await migrate(large);
  console.log(
    'Created and migrated only the fresh marked large GitHub test database; no ordinary database was touched.',
  );
} catch {
  await large.query('ROLLBACK').catch(() => {});
  throw new Error('Owned large test database setup failed.');
} finally {
  await large.end();
}
