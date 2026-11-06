import assert from 'node:assert/strict';
import pg from 'pg';

assert.equal(
  process.env.GITHUB_ACTIONS,
  'true',
  'Only a disposable GitHub test runner is supported.',
);
assert.equal(process.env.PLATYPUS_PG_TEST_OWNED, '1');
assert.equal(process.env.PGDATABASE, 'platypus_service_test');
assert.equal(process.env.PGHOST, '127.0.0.1');
assert.equal(process.env.PG_TEST_APP_USER, 'platypus_app_test');
assert.equal(process.env.PG_TEST_APP_PASSWORD, 'ci-app-only');
const pool = new pg.Pool({ connectionTimeoutMillis: 3000, max: 1 });
try {
  assert.equal(
    (await pool.query('SELECT current_database() AS name')).rows[0].name,
    'platypus_service_test',
  );
  await pool.query('BEGIN');
  await pool.query(
    'CREATE TABLE public.platypus_test_ownership (marker text PRIMARY KEY)',
  );
  await pool.query(
    "INSERT INTO public.platypus_test_ownership VALUES ('platypus-service-disposable-tests')",
  );
  await pool.query(
    "CREATE ROLE platypus_app_test LOGIN PASSWORD 'ci-app-only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT",
  );
  await pool.query('REVOKE ALL ON DATABASE platypus_service_test FROM PUBLIC');
  await pool.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await pool.query('COMMIT');
  console.log(
    'Created isolated test ownership marker and separate application role.',
  );
} catch {
  await pool.query('ROLLBACK').catch(() => {});
  throw new Error(
    'Disposable PostgreSQL setup failed; no ordinary database is accepted.',
  );
} finally {
  await pool.end();
}
