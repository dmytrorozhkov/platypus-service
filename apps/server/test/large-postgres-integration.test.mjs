import assert from 'node:assert/strict';
import test from 'node:test';
import { Pool } from 'pg';
import { explicitConnectionFromEnvironment } from '../database/migrate-seed.mjs';
import {
  generateLargeDataset,
  datasetChecksums,
  LARGE_COUNTS,
} from '../database/large/dataset.mjs';
import {
  assertLargeTarget,
  seedLarge,
  verifyLarge,
} from '../database/large/seed-large.mjs';

async function rejectedStatement(pool, sql, expectedCode) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assert.rejects(
      client.query(sql),
      (error) => error.code === expectedCode,
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}

test('real isolated large PostgreSQL seed, provenance, complete fingerprint and permissions', async (t) => {
  assert.equal(
    process.env.GITHUB_ACTIONS,
    'true',
    'This test uses only a fresh GitHub-owned disposable service.',
  );
  assert.equal(process.env.PLATYPUS_PG_TEST_OWNED, '1');
  assert.equal(process.env.PLATYPUS_LARGE_TEST_OWNED, '1');
  assert.equal(process.env.PGDATABASE, 'platypus_service_large_test');
  const configuration = explicitConnectionFromEnvironment();
  const appUser = process.env.PG_TEST_APP_USER;
  assert.match(appUser ?? '', /^[a-z_][a-z0-9_]*$/);
  assert(process.env.PG_TEST_APP_PASSWORD && appUser !== configuration.user);
  const owner = new Pool({
    ...configuration,
    max: 4,
    application_name: 'platypus-large-data-test',
  });
  const runtime = new Pool({
    ...configuration,
    user: appUser,
    password: process.env.PG_TEST_APP_PASSWORD,
    max: 1,
    application_name: 'platypus-large-runtime-test',
  });
  owner.on('error', () => {});
  runtime.on('error', () => {});
  t.after(() => Promise.all([owner.end(), runtime.end()]));
  const guardClient = await owner.connect();
  try {
    assert.equal(
      await assertLargeTarget(guardClient),
      'platypus_service_large_test',
    );
  } finally {
    guardClient.release();
  }
  const dataset = generateLargeDataset();
  const expected = datasetChecksums(dataset);

  await t.test(
    'preinitialized001 schema starts empty and unrelated partial data is refused',
    async () => {
      assert.deepEqual(
        (await owner.query('SELECT version FROM platypus.schema_migrations'))
          .rows,
        [{ version: '001' }],
      );
      assert.equal(
        Number(
          (await owner.query('SELECT count(*) AS count FROM platypus.tickets'))
            .rows[0].count,
        ),
        0,
      );
      const sentinel = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
      await owner.query(
        'INSERT INTO platypus.organizations(id,display_name) VALUES ($1,$2)',
        [sentinel, 'Owned refusal test'],
      );
      try {
        await assert.rejects(seedLarge(owner), /empty business tables/);
      } finally {
        await owner.query('DELETE FROM platypus.organizations WHERE id=$1', [
          sentinel,
        ]);
      }
    },
  );

  await t.test(
    'a failure in the last batch rolls back all100000 rows and seed/index provenance',
    async () => {
      await owner.query(
        "ALTER TABLE platypus.tickets ADD CONSTRAINT stage065_late_failure CHECK (number <> 'PS-100000')",
      );
      try {
        await assert.rejects(
          seedLarge(owner),
          (error) => error.code === '23514',
        );
        for (const table of [
          'organizations',
          'support_agents',
          'tickets',
          'seed_runs',
        ])
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
        assert.equal(
          (
            await owner.query(
              "SELECT indexname FROM pg_indexes WHERE schemaname='platypus' AND indexname LIKE 'large_%'",
            )
          ).rows.length,
          0,
        );
      } finally {
        await owner.query(
          'ALTER TABLE platypus.tickets DROP CONSTRAINT stage065_late_failure',
        );
      }
    },
  );

  await t.test(
    'concurrent first seeds apply exactly once or fail with a bounded lock wait',
    async () => {
      const results = await Promise.allSettled([
        seedLarge(owner),
        seedLarge(owner),
      ]);
      assert.equal(
        results.filter(
          (result) => result.status === 'fulfilled' && result.value.applied,
        ).length,
        1,
      );
      for (const result of results)
        if (result.status === 'rejected')
          assert(['55P03', '57014'].includes(result.reason.code));
      assert.equal((await seedLarge(owner)).applied, false);
      const verified = await verifyLarge(owner);
      assert.deepEqual(verified.counts, LARGE_COUNTS);
      assert.equal(verified.unassigned, 14286);
      assert.equal(verified.contentMatchesSeed, true);
      assert.deepEqual(verified.checksums, {
        organizations: expected.organizations,
        supportAgents: expected.supportAgents,
        tickets: expected.tickets,
      });
      assert.equal(verified.indexes.length, 6);
      assert.deepEqual(verified.statuses, [
        { status: 'Awaiting customer', count: 25000 },
        { status: 'Closed', count: 25000 },
        { status: 'In progress', count: 25000 },
        { status: 'New', count: 25000 },
      ]);
      t.diagnostic(
        JSON.stringify({
          dataset: 'tickets-large-v1',
          counts: verified.counts,
          seedChecks: results.map((result) =>
            result.status === 'fulfilled'
              ? {
                  applied: result.value.applied,
                  elapsedMs: result.value.elapsedMs,
                }
              : { code: result.reason.code },
          ),
          verificationElapsedMs: verified.elapsedMs,
        }),
      );
    },
  );

  await t.test(
    'unchanged repeat preserves edits and deletions without silently repairing data',
    async () => {
      const first = dataset.tickets[0];
      const last = dataset.tickets.at(-1);
      try {
        await owner.query(
          'UPDATE platypus.tickets SET subject=$1 WHERE id=$2',
          ['Owned large saved edit', first.id],
        );
        assert.equal((await seedLarge(owner)).applied, false);
        assert.deepEqual(
          (
            await owner.query(
              'SELECT id,subject FROM platypus.tickets WHERE number=$1',
              [first.number],
            )
          ).rows[0],
          { id: first.id, subject: 'Owned large saved edit' },
        );
        assert.equal((await verifyLarge(owner)).contentMatchesSeed, false);
      } finally {
        await owner.query(
          'UPDATE platypus.tickets SET subject=$1 WHERE id=$2',
          [first.subject, first.id],
        );
      }
      try {
        await owner.query('DELETE FROM platypus.tickets WHERE id=$1', [
          last.id,
        ]);
        assert.equal((await seedLarge(owner)).applied, false);
        assert.equal(
          Number(
            (
              await owner.query(
                'SELECT count(*) AS count FROM platypus.tickets',
              )
            ).rows[0].count,
          ),
          99999,
        );
        await assert.rejects(verifyLarge(owner), /counts differ/);
      } finally {
        await owner.query(
          'INSERT INTO platypus.tickets(id,number,subject,organization_id,status,assignee_id,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [
            last.id,
            last.number,
            last.subject,
            last.organizationId,
            last.status,
            last.assigneeId,
            last.createdAt,
            last.updatedAt,
          ],
        );
      }
    },
  );

  await t.test(
    'seed checksum and actual query-index drift fail closed without reset',
    async () => {
      const recorded = (
        await owner.query(
          "SELECT checksum FROM platypus.seed_runs WHERE seed_key='tickets-large-v1'",
        )
      ).rows[0].checksum;
      await owner.query(
        "UPDATE platypus.seed_runs SET checksum='changed' WHERE seed_key='tickets-large-v1'",
      );
      try {
        await assert.rejects(seedLarge(owner), /provenance/);
      } finally {
        await owner.query(
          "UPDATE platypus.seed_runs SET checksum=$1 WHERE seed_key='tickets-large-v1'",
          [recorded],
        );
      }
      await owner.query(
        'ALTER INDEX platypus.large_tickets_number_order_idx RENAME TO stage065_temporarily_renamed',
      );
      try {
        await assert.rejects(seedLarge(owner), /provenance/);
      } finally {
        await owner.query(
          'ALTER INDEX platypus.stage065_temporarily_renamed RENAME TO large_tickets_number_order_idx',
        );
      }
      assert.equal((await verifyLarge(owner)).contentMatchesSeed, true);
    },
  );

  await t.test(
    'large records retain actual SQL constraints and valid unassigned rows',
    async () => {
      for (const [sql, code] of [
        [
          "UPDATE platypus.tickets SET status='Unknown' WHERE number='PS-1'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET subject=' ' WHERE number='PS-1'",
          '23514',
        ],
        [
          "UPDATE platypus.tickets SET number='PS-2' WHERE number='PS-1'",
          '23505',
        ],
        [
          "UPDATE platypus.tickets SET organization_id='ffffffff-ffff-4fff-8fff-ffffffffffff' WHERE number='PS-1'",
          '23503',
        ],
        [
          "UPDATE platypus.tickets SET assignee_id='ffffffff-ffff-4fff-8fff-ffffffffffff' WHERE number='PS-1'",
          '23503',
        ],
        [
          "UPDATE platypus.tickets SET created_at='infinity' WHERE number='PS-1'",
          '23514',
        ],
        [
          "DELETE FROM platypus.organizations WHERE id='41000000-0000-4000-8000-000000000001'",
          '23001',
        ],
      ])
        await rejectedStatement(owner, sql, code);
      assert.equal(
        (
          await owner.query(
            "SELECT assignee_id FROM platypus.tickets WHERE number='PS-1'",
          )
        ).rows[0].assignee_id,
        null,
      );
    },
  );

  await t.test(
    'runtime role reads bounded pages but cannot write/schema/ledger',
    async () => {
      await owner.query(
        `GRANT CONNECT ON DATABASE platypus_service_large_test TO "${appUser}"`,
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
      assert.equal(
        (
          await runtime.query(
            'SELECT number FROM platypus.tickets ORDER BY created_at DESC,number LIMIT 100',
          )
        ).rows.length,
        100,
      );
      for (const sql of [
        "UPDATE platypus.tickets SET subject='forbidden' WHERE number='PS-1'",
        "DELETE FROM platypus.tickets WHERE number='PS-1'",
        "INSERT INTO platypus.organizations(id,display_name) VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff','forbidden')",
        'CREATE TABLE platypus.stage065_forbidden(id integer)',
        'DROP TABLE platypus.tickets',
        'SELECT * FROM platypus.seed_runs',
      ])
        await rejectedStatement(runtime, sql, '42501');
    },
  );

  const final = await verifyLarge(owner);
  assert.deepEqual(final.counts, LARGE_COUNTS);
  assert.equal(final.contentMatchesSeed, true);
});
