import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { buildSnapshot } from '../database/neon/snapshot.mjs';
import {
  exportDatabase,
  importDatabase,
  verifyDatabase,
} from '../database/neon/transfer.mjs';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
async function fixture(size = 2) {
  return buildSnapshot({
    organizations: [
      { id: id(1), display_name: 'A | Unicode Зміна\norganization' },
    ],
    support_agents: [{ id: id(2), display_name: 'Agent 🦆' }],
    tickets: Array.from({ length: size }, (_, n) => ({
      id: id(n + 3),
      number: `PS-${n + 1}`,
      subject:
        n === 0
          ? "Actual edited text '); DROP SCHEMA public; --\nnot regenerated"
          : `Ticket ${n}`,
      organization_id: id(1),
      status: n % 2 ? 'Closed' : 'New',
      assignee_id: n % 2 ? null : id(2),
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-02T00:00:00.000Z',
    })),
  });
}

function catalogs() {
  const specs = {
    migration_imports: [
      ['singleton', 'boolean'],
      ['artifact_sha256', 'text'],
      ['data_sha256', 'text'],
      ['schema_sha256', 'text'],
      ['index_sha256', 'text'],
      ['shape_sha256', 'text'],
      ['imported_at', 'timestamp with time zone', false, 'now()'],
    ],
    organizations: [
      ['id', 'uuid'],
      ['display_name', 'text'],
    ],
    schema_migrations: [
      ['version', 'text'],
      ['checksum', 'text'],
      ['applied_at', 'timestamp with time zone', false, 'now()'],
    ],
    seed_runs: [
      ['seed_key', 'text'],
      ['checksum', 'text'],
      ['applied_at', 'timestamp with time zone', false, 'now()'],
    ],
    support_agents: [
      ['id', 'uuid'],
      ['display_name', 'text'],
    ],
    tickets: [
      ['id', 'uuid'],
      ['number', 'text'],
      ['subject', 'text'],
      ['organization_id', 'uuid'],
      ['status', 'text'],
      ['assignee_id', 'uuid', true],
      ['created_at', 'timestamp(3) with time zone'],
      ['updated_at', 'timestamp(3) with time zone'],
    ],
  };
  const constraintSpecs = {
    migration_imports: {
      migration_imports_pkey: 'p',
      migration_imports_singleton_check: 'c',
    },
    organizations: {
      organizations_pkey: 'p',
      organizations_name_nonblank: 'c',
    },
    schema_migrations: { schema_migrations_pkey: 'p' },
    seed_runs: { seed_runs_pkey: 'p' },
    support_agents: {
      support_agents_pkey: 'p',
      support_agents_name_nonblank: 'c',
    },
    tickets: {
      tickets_pkey: 'p',
      tickets_number_key: 'u',
      tickets_organization_id_fkey: 'f',
      tickets_assignee_id_fkey: 'f',
      tickets_number_format: 'c',
      tickets_subject_nonblank: 'c',
      tickets_status_known: 'c',
      tickets_created_finite: 'c',
      tickets_updated_finite: 'c',
      tickets_time_order: 'c',
    },
  };
  const nullChecks = Object.entries(specs).flatMap(([table_name, columns]) =>
    columns.flatMap(([name, , nullable = false], position) =>
      nullable
        ? []
        : [
            {
              table_name,
              constraint_name: table_name + '_' + name + '_not_null',
              constraint_type: 'n',
              definition: 'NOT NULL ' + name,
              validated: true,
              deferrable: false,
              deferred: false,
              enforced: true,
              column_numbers: '{' + (position + 1) + '}',
            },
          ],
    ),
  );
  return {
    tables: Object.keys(specs)
      .sort()
      .map((table_name) => ({
        table_name,
        kind: 'r',
        row_security: false,
        force_row_security: false,
      })),
    columns: Object.entries(specs)
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([table_name, columns]) =>
        columns.map(
          ([
            column_name,
            type_name,
            nullable = false,
            default_expression = null,
          ]) => ({
            table_name,
            column_name,
            type_name,
            not_null: !nullable,
            default_expression,
            identity_kind: '',
            generated_kind: '',
          }),
        ),
      ),
    checks: [
      ...nullChecks,
      ...Object.entries(constraintSpecs)
        .sort(([a], [b]) => a.localeCompare(b))
        .flatMap(([table_name, constraints]) =>
          Object.entries(constraints)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([constraint_name, constraint_type]) => ({
              table_name,
              constraint_name,
              constraint_type,
              definition: `${constraint_type} ${constraint_name}`,
              validated: true,
              deferrable: false,
              deferred: false,
              enforced: true,
              column_numbers: null,
            })),
        ),
    ].sort(
      (a, b) =>
        a.table_name.localeCompare(b.table_name) ||
        a.constraint_name.localeCompare(b.constraint_name),
    ),
    indexes: [
      ...Object.entries(constraintSpecs).flatMap(([table_name, constraints]) =>
        Object.entries(constraints)
          .filter(([, type]) => ['p', 'u'].includes(type))
          .map(([index_name, type]) => ({
            index_name,
            table_name,
            definition: `${index_name} definition`,
            valid: true,
            ready: true,
            unique_index: true,
            primary_index: type === 'p',
          })),
      ),
      ...[
        'tickets_created_number_idx',
        'large_tickets_number_order_idx',
        'large_tickets_created_order_idx',
        'large_tickets_updated_order_idx',
        'large_tickets_status_created_idx',
        'large_tickets_organization_created_idx',
        'large_tickets_assignee_created_idx',
      ].map((index_name) => ({
        index_name,
        table_name: 'tickets',
        definition: `${index_name} definition`,
        valid: true,
        ready: true,
        unique_index: false,
        primary_index: false,
      })),
    ].sort((a, b) => a.index_name.localeCompare(b.index_name)),
  };
}

function database(snapshot, options = {}) {
  const state = {
    present: options.existing ?? false,
    data: structuredClone(snapshot.data),
    ledger: [],
    migrations: [],
    seeds: [],
    shape: catalogs(),
    triggers: [],
    calls: [],
    acquired: true,
  };
  let backup;
  let ticketBatches = 0;
  const client = {
    async query(sql, values) {
      state.calls.push({ sql, values });
      if (sql.startsWith('BEGIN')) {
        backup = structuredClone({
          present: state.present,
          data: state.data,
          ledger: state.ledger,
          migrations: state.migrations,
        });
        return { rows: [] };
      }
      if (sql === 'ROLLBACK') {
        if (options.rollbackFailure)
          throw new Error('sensitive rollback password');
        Object.assign(state, backup);
        return { rows: [] };
      }
      if (sql === 'COMMIT') {
        if (options.commitFailure) throw new Error('sensitive server secret');
        return { rows: [] };
      }
      if (options.failSql?.(sql)) throw new Error('sensitive query secret');
      if (sql.startsWith('SET LOCAL')) return { rows: [] };
      if (sql.startsWith('LOCK TABLE')) return { rows: [] };
      if (sql.includes('pg_try_advisory'))
        return { rows: [{ acquired: state.acquired }] };
      if (sql.includes('SELECT EXISTS'))
        return { rows: [{ present: state.present }] };
      if (sql === 'CREATE SCHEMA platypus') {
        state.present = true;
        state.data = { organizations: [], support_agents: [], tickets: [] };
        return { rows: [] };
      }
      if (sql.startsWith('CREATE TABLE') || sql.startsWith('CREATE INDEX'))
        return { rows: [] };
      if (sql.includes('pg_get_indexdef'))
        return { rows: structuredClone(state.shape.indexes) };
      if (sql.includes('FROM pg_attribute'))
        return { rows: structuredClone(state.shape.columns) };
      if (sql.includes('FROM pg_constraint'))
        return { rows: structuredClone(state.shape.checks) };
      if (sql.includes('FROM pg_class'))
        return { rows: structuredClone(state.shape.tables) };
      if (sql.includes('FROM pg_trigger')) return { rows: state.triggers };
      if (sql.startsWith('INSERT INTO platypus.schema_migrations')) {
        state.migrations.push({ version: values[0], checksum: values[1] });
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO platypus.migration_imports')) {
        state.ledger.push({
          singleton: true,
          artifact_sha256: values[0],
          data_sha256: values[1],
          schema_sha256: values[2],
          index_sha256: values[3],
          shape_sha256: values[4],
        });
        return { rows: [] };
      }
      if (sql.startsWith('INSERT INTO platypus.')) {
        const [, table, fields] =
          /^INSERT INTO platypus\.(\w+) \(([^)]+)\)/.exec(sql);
        const names = fields.split(', ');
        if (table === 'tickets' && ++ticketBatches === options.failBatch)
          throw new Error('sensitive late batch query');
        for (let n = 0; n < values.length; n += names.length)
          state.data[table].push(
            Object.fromEntries(
              names.map((name, col) => [name, values[n + col]]),
            ),
          );
        return { rows: [] };
      }
      if (sql.includes('FROM platypus.migration_imports'))
        return { rows: state.ledger };
      if (sql.includes('FROM platypus.schema_migrations'))
        return { rows: state.migrations };
      if (sql.includes('FROM platypus.seed_runs')) return { rows: state.seeds };
      if (sql.includes('JOIN platypus.organizations')) {
        return {
          rows: state.data.tickets.slice(0, 25).map((r) => ({
            id: r.id,
            organization_name: state.data.organizations.find(
              (o) => o.id === r.organization_id,
            ).display_name,
            assignee_name:
              state.data.support_agents.find((a) => a.id === r.assignee_id)
                ?.display_name ?? null,
          })),
        };
      }
      if (sql.includes('WHERE status = $1'))
        return {
          rows: state.data.tickets
            .filter((r) => r.status === values[0])
            .sort(
              (a, b) =>
                b.created_at.localeCompare(a.created_at) ||
                a.id.localeCompare(b.id),
            )
            .slice(0, 25)
            .map((r) => ({ id: r.id })),
        };
      if (sql.includes('snapshot_budget') || sql.includes('AS bytes'))
        return { rows: [{ bytes: '1000' }] };
      for (const table of ['organizations', 'support_agents', 'tickets'])
        if (sql.includes(`FROM platypus.${table}`))
          return { rows: structuredClone(state.data[table]) };
      throw new Error(
        'Unexpected fake SQL; adapt the sentinel to the source contract.',
      );
    },
    end() {
      assert.fail('Transfer must not end a caller-owned client.');
    },
    release() {
      assert.fail('Transfer must not release a caller-owned client.');
    },
  };
  return { client, state };
}

test('export owns a consistent read-only transaction and preserves real edited text', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot);
  assert.deepEqual(await exportDatabase(client), snapshot);
  assert.equal(
    state.calls[0].sql,
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
  );
  assert.equal(state.calls.at(-1).sql, 'COMMIT');
  assert.ok(
    state.calls.every(({ sql }) =>
      /^(BEGIN|SET LOCAL|SELECT|WITH|COMMIT)/.test(sql.trim()),
    ),
  );
});

test('invalid snapshots are rejected before any target SQL', async () => {
  const snapshot = structuredClone(await fixture());
  snapshot.data.tickets[0].subject = '';
  const { client, state } = database(snapshot);
  await assert.rejects(importDatabase(client, snapshot));
  await assert.rejects(verifyDatabase(client, snapshot));
  assert.equal(state.calls.length, 0);
});

test('first import parameterizes actual rows, checks full content, records distinct provenance then commits', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot);
  const result = await importDatabase(client, snapshot);
  assert.equal(result.imported, true);
  assert.deepEqual(result.counts, {
    organizations: 1,
    support_agents: 1,
    tickets: 2,
  });
  assert.deepEqual(state.data, snapshot.data);
  assert.equal(state.ledger.length, 1);
  assert.equal(state.seeds.length, 0);
  const business = state.calls.filter(({ sql }) =>
    sql.startsWith('INSERT INTO platypus.tickets'),
  );
  assert.ok(business[0].values.includes(snapshot.data.tickets[0].subject));
  assert.ok(!business[0].sql.includes('DROP SCHEMA'));
  assert.equal(state.calls.at(-1).sql, 'COMMIT');
  assert.ok(
    state.calls.findIndex(({ sql }) => sql.includes('WHERE status = $1')) <
      state.calls.length - 1,
  );
});

test('inserts are bounded to1000 rows and a failed late batch rolls back schema, data and ledger', async () => {
  const snapshot = await fixture(1001);
  const good = database(snapshot);
  await importDatabase(good.client, snapshot);
  const batches = good.state.calls.filter(({ sql }) =>
    sql.startsWith('INSERT INTO platypus.tickets'),
  );
  assert.deepEqual(
    batches.map(({ values }) => values.length),
    [8000, 8],
  );
  const bad = database(snapshot, { failBatch: 2 });
  await assert.rejects(
    importDatabase(bad.client, snapshot),
    /transaction failed/,
  );
  assert.equal(bad.state.present, false);
  assert.equal(bad.state.ledger.length, 0);
  assert.equal(bad.state.calls.at(-1).sql, 'ROLLBACK');
  assert.ok(!bad.state.calls.some(({ sql }) => sql === 'COMMIT'));
});

test('identical rerun verifies without any new DDL or inserts and explicit verify is read-only', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot);
  await importDatabase(client, snapshot);
  state.calls.length = 0;
  assert.equal((await importDatabase(client, snapshot)).imported, false);
  assert.ok(
    !state.calls.some(({ sql }) => /^(CREATE|INSERT|UPDATE|DELETE)/.test(sql)),
  );
  state.calls.length = 0;
  assert.equal((await verifyDatabase(client, snapshot)).verified, true);
  assert.equal(
    state.calls[0].sql,
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
  );
});

test('unknown existing target is refused without adoption or repair', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot, { existing: true });
  state.shape.tables.pop();
  await assert.rejects(importDatabase(client, snapshot), /inventory differs/);
  assert.ok(
    !state.calls.some(({ sql }) =>
      /^(CREATE|INSERT|UPDATE|DELETE|DROP)/.test(sql),
    ),
  );
});

test('changed snapshot and changed target content independently refuse a rerun', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot);
  await importDatabase(client, snapshot);
  const changed = structuredClone(snapshot);
  changed.data.tickets[0].subject = 'New legitimate source edit';
  await assert.rejects(
    importDatabase(client, changed),
    /ledger or schema differs/,
  );
  state.data.tickets[0].subject = 'Target tampering';
  await assert.rejects(verifyDatabase(client, snapshot), /content differs/);
});

test('schema drift in columns, constraint definitions and index definitions is refused', async () => {
  const snapshot = await fixture();
  for (const alter of [
    (state) => {
      state.shape.columns[0].type_name = 'text';
    },
    (state) => {
      state.shape.checks[0].definition = 'weakened constraint';
    },
    (state) => {
      state.shape.indexes[0].definition = 'different expression';
    },
    (state) => {
      state.shape.indexes[0].valid = false;
    },
    (state) => {
      state.triggers.push({ tgname: 'unexpected' });
    },
  ]) {
    const { client, state } = database(snapshot);
    await importDatabase(client, snapshot);
    alter(state);
    await assert.rejects(verifyDatabase(client, snapshot));
  }
});

test('seed provenance and ledger duplication cannot be silently accepted', async () => {
  const snapshot = await fixture();
  for (const alter of [
    (state) => state.seeds.push({ seed_key: 'generator', checksum: 'fake' }),
    (state) => state.ledger.push({ ...state.ledger[0], singleton: false }),
    (state) => {
      state.migrations[0].checksum = 'changed';
    },
  ]) {
    const { client, state } = database(snapshot);
    await importDatabase(client, snapshot);
    alter(state);
    await assert.rejects(importDatabase(client, snapshot));
  }
});

test('busy migration lock fails before schema inspection or mutation', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot);
  state.acquired = false;
  await assert.rejects(
    importDatabase(client, snapshot),
    /holds the target import lock/,
  );
  assert.ok(
    !state.calls.some(
      ({ sql }) => sql.includes('SELECT EXISTS') || sql.startsWith('CREATE'),
    ),
  );
});

test('lost COMMIT response demands explicit verification and never promises rollback certainty', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot, { commitFailure: true });
  await assert.rejects(
    importDatabase(client, snapshot),
    /commit result is unknown.*Explicitly verify/,
  );
  assert.equal(state.calls.filter(({ sql }) => sql === 'COMMIT').length, 1);
});

test('query and rollback failures remain sanitized and never replay the operation', async () => {
  const snapshot = await fixture();
  const { client, state } = database(snapshot, {
    failSql: (sql) => sql.startsWith('INSERT INTO platypus.tickets'),
    rollbackFailure: true,
  });
  const error = await importDatabase(client, snapshot).catch((value) => value);
  assert.match(error.message, /transaction failed/);
  assert.ok(!JSON.stringify(error).includes('sensitive'));
  assert.equal(error.cause, undefined);
  assert.equal(
    state.calls.filter(({ sql }) =>
      sql.startsWith('INSERT INTO platypus.tickets'),
    ).length,
    1,
  );
});

test('schema checkout changes after snapshot validation are refused before any SQL', async () => {
  const snapshot = await fixture();
  const snapshotUrl = new URL('../database/neon/snapshot.mjs', import.meta.url)
    .href;
  const transferUrl = new URL('../database/neon/transfer.mjs', import.meta.url)
    .href;
  for (const changedDigest of ['schemaSha256', 'indexSha256']) {
    const script = `
      import assert from 'node:assert/strict';
      import { mock } from 'node:test';
      const snapshotModule = await import(${JSON.stringify(snapshotUrl)});
      mock.module(${JSON.stringify(snapshotUrl)}, { namedExports: {
        ...snapshotModule,
        loadSchema: async () => ({ ...await snapshotModule.loadSchema(), [${JSON.stringify(changedDigest)}]: '0'.repeat(64) }),
      }});
      const { importDatabase } = await import(${JSON.stringify(transferUrl)});
      let calls = 0;
      await assert.rejects(importDatabase({ query() { calls++; throw new Error('No SQL expected'); } }, ${JSON.stringify(snapshot)}), /schema files changed after snapshot validation/);
      assert.equal(calls, 0);
      mock.restoreAll();
    `;
    execFileSync(
      process.execPath,
      ['--experimental-test-module-mocks', '--input-type=module', '-e', script],
      { timeout: 10000, stdio: 'pipe' },
    );
  }
});
