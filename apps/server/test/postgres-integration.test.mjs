import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import {
  check,
  explicitConnectionFromEnvironment,
  loadSeedInput,
  migrate,
  seed,
} from '../database/migrate-seed.mjs';

const sqlPath = new URL('../database/001.sql', import.meta.url);
const fixturePath = new URL('../src/fixtures/tickets.json', import.meta.url);
const identityPath = new URL(
  '../database/seed-identities.json',
  import.meta.url,
);
const collectionSql = `SELECT t.number, t.subject, o.display_name AS organization,
  t.status, a.display_name AS assignee, t.created_at, t.updated_at
  FROM platypus.tickets t JOIN platypus.organizations o ON o.id = t.organization_id
  LEFT JOIN platypus.support_agents a ON a.id = t.assignee_id
  ORDER BY t.created_at, t.number`;

async function rejectedStatement(pool, sql, parameters, expectedCode) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      client.query(sql, parameters),
      (error) => error.code === expectedCode,
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

test('real PostgreSQL migration, seed, constraints and least-privilege boundary', async (t) => {
  assert.equal(
    process.env.PLATYPUS_PG_TEST_OWNED,
    '1',
    'Explicit disposable database marker is required; integration never silently skips.',
  );
  assert.equal(process.env.PGDATABASE, 'platypus_service_test');
  const config = explicitConnectionFromEnvironment();
  const appUser = process.env.PG_TEST_APP_USER;
  const appPassword = process.env.PG_TEST_APP_PASSWORD;
  assert.match(appUser ?? '', /^[a-z_][a-z0-9_]*$/);
  assert(appPassword && appUser !== config.user);
  const owner = new Pool({
    ...config,
    max: 4,
    application_name: 'platypus-data-tests',
  });
  const runtime = new Pool({
    ...config,
    user: appUser,
    password: appPassword,
    max: 1,
    application_name: 'platypus-runtime-permissions-test',
  });
  owner.on('error', () => {});
  runtime.on('error', () => {});
  t.after(async () => {
    await Promise.all([owner.end(), runtime.end()]);
  });
  assert.equal(
    (await owner.query('SELECT current_database() AS name')).rows[0].name,
    'platypus_service_test',
  );
  assert.deepEqual(
    (await owner.query('SELECT marker FROM public.platypus_test_ownership'))
      .rows,
    [{ marker: 'platypus-service-disposable-tests' }],
  );
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'platypus-data053-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const migrationSql = await readFile(sqlPath, 'utf8');
  const fixtures = JSON.parse(await readFile(fixturePath, 'utf8'));
  const canonical = fixtures.map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  }));

  await t.test(
    'failed first migration rolls back its tables and both ledgers',
    async () => {
      assert.equal(
        (await owner.query("SELECT to_regnamespace('platypus') AS name"))
          .rows[0].name,
        null,
        'Use a fresh isolated test service, not an already prepared database.',
      );
      await writeFile(path.join(temporary, '001.sql'), migrationSql);
      await writeFile(
        path.join(temporary, '002.sql'),
        'CREATE TABLE platypus.stage053_failed_batch(id integer); SELECT 1 / 0;\n',
      );
      await assert.rejects(
        migrate(owner, { migrationsDirectory: temporary }),
        (error) => error.code === '22012',
      );
      assert.equal(
        (await owner.query("SELECT to_regnamespace('platypus') AS name"))
          .rows[0].name,
        null,
      );
      await rm(path.join(temporary, '002.sql'));
    },
  );

  await t.test(
    'concurrent migrations apply one immutable version exactly once',
    async () => {
      const results = await Promise.all([migrate(owner), migrate(owner)]);
      assert.equal(results.flatMap((result) => result.applied).length, 1);
      assert.deepEqual(
        (await owner.query('SELECT version FROM platypus.schema_migrations'))
          .rows,
        [{ version: '001' }],
      );
      assert.deepEqual(await migrate(owner), { applied: [] });
      await writeFile(
        path.join(temporary, '001.sql'),
        migrationSql + '\n-- deliberately changed test copy\n',
      );
      await assert.rejects(
        migrate(owner, { migrationsDirectory: temporary }),
        /missing, changed or newer/,
      );
      await writeFile(path.join(temporary, '001.sql'), migrationSql);
    },
  );

  await t.test(
    'seed refuses partial prepopulation and rolls back a late failure',
    async () => {
      const sentinel = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      await owner.query(
        'INSERT INTO platypus.organizations(id,display_name) VALUES ($1,$2)',
        [sentinel, 'Test-owned partial directory'],
      );
      try {
        await assert.rejects(seed(owner), /empty business tables/);
      } finally {
        await owner.query('DELETE FROM platypus.organizations WHERE id=$1', [
          sentinel,
        ]);
      }
      await owner.query(
        "ALTER TABLE platypus.tickets ADD CONSTRAINT stage053_seed_failure CHECK (number <> 'PS-1025')",
      );
      try {
        await assert.rejects(seed(owner), (error) => error.code === '23514');
        for (const table of [
          'organizations',
          'support_agents',
          'tickets',
          'seed_runs',
        ]) {
          assert.equal(
            Number(
              (
                await owner.query(
                  `SELECT count(*) AS count FROM platypus.${table}`,
                )
              ).rows[0].count,
            ),
            0,
          );
        }
      } finally {
        await owner.query(
          'ALTER TABLE platypus.tickets DROP CONSTRAINT stage053_seed_failure',
        );
      }
    },
  );

  await t.test(
    'concurrent seed gives five organizations, three directory entries and exact 25-ticket values',
    async () => {
      const results = await Promise.all([seed(owner), seed(owner)]);
      assert.equal(results.filter((result) => result.applied).length, 1);
      assert.equal(
        Number(
          (
            await owner.query(
              'SELECT count(*) AS count FROM platypus.organizations',
            )
          ).rows[0].count,
        ),
        5,
      );
      assert.equal(
        Number(
          (
            await owner.query(
              'SELECT count(*) AS count FROM platypus.support_agents',
            )
          ).rows[0].count,
        ),
        3,
      );
      const rows = (await owner.query(collectionSql)).rows.map(
        ({ created_at, updated_at, ...row }) => ({
          ...row,
          createdAt: created_at.toISOString(),
          updatedAt: updated_at.toISOString(),
        }),
      );
      assert.deepEqual(rows, canonical);
      assert.deepEqual(await check(owner), {
        schema: 'current',
        readable: true,
      });
    },
  );

  await t.test(
    'repeating seed preserves edits, deleted rows and identifiers, and rejects content drift',
    async () => {
      const before = (
        await owner.query(
          "SELECT * FROM platypus.tickets WHERE number='PS-1025'",
        )
      ).rows[0];
      const first = (
        await owner.query(
          "SELECT id FROM platypus.tickets WHERE number='PS-1001'",
        )
      ).rows[0];
      try {
        await owner.query(
          "UPDATE platypus.tickets SET subject=$1 WHERE number='PS-1001'",
          ['Test-owned saved edit'],
        );
        await owner.query(
          "DELETE FROM platypus.tickets WHERE number='PS-1025'",
        );
        assert.equal((await seed(owner)).applied, false);
        assert.deepEqual(
          (
            await owner.query(
              "SELECT id,subject FROM platypus.tickets WHERE number='PS-1001'",
            )
          ).rows[0],
          { id: first.id, subject: 'Test-owned saved edit' },
        );
        assert.equal(
          Number(
            (
              await owner.query(
                'SELECT count(*) AS count FROM platypus.tickets',
              )
            ).rows[0].count,
          ),
          24,
        );
        const changed = structuredClone(fixtures);
        changed[0].subject += ' drift';
        const changedFixture = path.join(temporary, 'changed-fixture.json');
        await writeFile(changedFixture, JSON.stringify(changed));
        await assert.rejects(
          seed(owner, {
            fixturePath: changedFixture,
            identitiesPath: identityPath,
          }),
          /checksum differs/,
        );
      } finally {
        await owner.query(
          "UPDATE platypus.tickets SET subject=$1 WHERE number='PS-1001'",
          [fixtures[0].subject],
        );
        await owner.query(
          `INSERT INTO platypus.tickets(id,number,subject,organization_id,status,assignee_id,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            before.id,
            before.number,
            before.subject,
            before.organization_id,
            before.status,
            before.assignee_id,
            before.created_at,
            before.updated_at,
          ],
        );
      }
    },
  );

  await t.test(
    'database constraints enforce relations, fields, ordering and finite timestamps',
    async () => {
      const statements = [
        [
          "UPDATE platypus.tickets SET status='Unknown' WHERE number='PS-1001'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET subject='  ' WHERE number='PS-1001'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET subject=E'\\t\\n' WHERE number='PS-1001'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET subject=NULL WHERE number='PS-1001'",
          '23502',
        ],
        [
          "UPDATE platypus.tickets SET number='PS-1002' WHERE number='PS-1001'",
          '23505',
        ],
        [
          "UPDATE platypus.tickets SET number='PS-0' WHERE number='PS-1001'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET organization_id='ffffffff-ffff-4fff-8fff-ffffffffffff' WHERE number='PS-1001'",
          '23503',
        ],
        [
          "UPDATE platypus.tickets SET organization_id=NULL WHERE number='PS-1001'",
          '23502',
        ],
        [
          "UPDATE platypus.tickets SET assignee_id='ffffffff-ffff-4fff-8fff-ffffffffffff' WHERE number='PS-1001'",
          '23503',
        ],
        [
          "UPDATE platypus.tickets SET created_at='infinity' WHERE number='PS-1001'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET updated_at='-infinity' WHERE number='PS-1001'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET updated_at=created_at-interval '1 second' WHERE number='PS-1001'",
          '23514',
        ],
        ["UPDATE platypus.organizations SET display_name=' '", '23514'],
        ["UPDATE platypus.support_agents SET display_name=' '", '23514'],
        ['DELETE FROM platypus.organizations', '23001'],
        ['DELETE FROM platypus.support_agents', '23001'],
      ];
      for (const [sql, code] of statements)
        await rejectedStatement(owner, sql, undefined, code);
      const client = await owner.connect();
      try {
        await client.query('BEGIN');
        await client.query("SET LOCAL TIME ZONE 'Pacific/Auckland'");
        const timestamps = (
          await client.query(
            'SELECT created_at,updated_at FROM platypus.tickets ORDER BY created_at,number',
          )
        ).rows;
        assert.deepEqual(
          timestamps.map((row) => [
            row.created_at.toISOString(),
            row.updated_at.toISOString(),
          ]),
          canonical.map((row) => [row.createdAt, row.updatedAt]),
        );
        await client.query(
          "UPDATE platypus.organizations SET display_name='Duplicate names remain valid'",
        );
        await client.query(
          "UPDATE platypus.support_agents SET display_name='Duplicate human names remain valid'",
        );
        await client.query(
          "UPDATE platypus.tickets SET assignee_id=(SELECT id FROM platypus.support_agents LIMIT 1) WHERE number='PS-1001'",
        );
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
    },
  );

  await t.test(
    'distinct runtime role can read only and cannot change schema or business data',
    async () => {
      await owner.query(
        `GRANT CONNECT ON DATABASE platypus_service_test TO "${appUser}"`,
      );
      await owner.query(`GRANT USAGE ON SCHEMA platypus TO "${appUser}"`);
      await owner.query(
        `GRANT SELECT ON platypus.organizations,platypus.support_agents,platypus.tickets TO "${appUser}"`,
      );
      assert.deepEqual(
        (
          await runtime.query(
            'SELECT rolsuper,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user',
          )
        ).rows,
        [{ rolsuper: false, rolcreatedb: false, rolcreaterole: false }],
      );
      assert.equal((await runtime.query(collectionSql)).rows.length, 25);
      for (const sql of [
        "UPDATE platypus.tickets SET subject='forbidden'",
        'DELETE FROM platypus.tickets',
        "INSERT INTO platypus.organizations(id,display_name) VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','forbidden')",
        'CREATE TABLE platypus.stage053_forbidden(id integer)',
        'DROP TABLE platypus.tickets',
        'SELECT * FROM platypus.schema_migrations',
      ])
        await rejectedStatement(runtime, sql, undefined, '42501');
      assert.equal((await runtime.query(collectionSql)).rows.length, 25);
    },
  );

  assert.equal((await seed(owner)).applied, false);
  assert.deepEqual(
    (await owner.query(collectionSql)).rows.map(
      ({ created_at, updated_at, ...row }) => ({
        ...row,
        createdAt: created_at.toISOString(),
        updatedAt: updated_at.toISOString(),
      }),
    ),
    canonical,
  );
  assert.equal((await loadSeedInput()).tickets.length, 25);
});
