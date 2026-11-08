import { createHash } from 'node:crypto';
import {
  validateSnapshot,
  encodeSnapshot,
  snapshotSha256,
  dataFingerprint,
  readSnapshot,
  loadSchema,
} from './snapshot.mjs';

export class TransferError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new TransferError(message);
}

const tableNames = [
  'migration_imports',
  'organizations',
  'schema_migrations',
  'seed_runs',
  'support_agents',
  'tickets',
].sort();
const indexNames = [
  'migration_imports_pkey',
  'organizations_pkey',
  'schema_migrations_pkey',
  'seed_runs_pkey',
  'support_agents_pkey',
  'tickets_pkey',
  'tickets_number_key',
  'tickets_created_number_idx',
  'large_tickets_number_order_idx',
  'large_tickets_created_order_idx',
  'large_tickets_updated_order_idx',
  'large_tickets_status_created_idx',
  'large_tickets_organization_created_idx',
  'large_tickets_assignee_created_idx',
].sort();
const constraints = {
  migration_imports: {
    migration_imports_pkey: 'p',
    migration_imports_singleton_check: 'c',
  },
  organizations: { organizations_pkey: 'p', organizations_name_nonblank: 'c' },
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
const column = (name, type, nullable = false, defaultExpression = null) => ({
  column_name: name,
  type_name: type,
  not_null: !nullable,
  default_expression: defaultExpression,
});
const expectedColumns = {
  migration_imports: [
    column('singleton', 'boolean'),
    column('artifact_sha256', 'text'),
    column('data_sha256', 'text'),
    column('schema_sha256', 'text'),
    column('index_sha256', 'text'),
    column('shape_sha256', 'text'),
    column('imported_at', 'timestamp with time zone', false, 'now()'),
  ],
  organizations: [column('id', 'uuid'), column('display_name', 'text')],
  schema_migrations: [
    column('version', 'text'),
    column('checksum', 'text'),
    column('applied_at', 'timestamp with time zone', false, 'now()'),
  ],
  seed_runs: [
    column('seed_key', 'text'),
    column('checksum', 'text'),
    column('applied_at', 'timestamp with time zone', false, 'now()'),
  ],
  support_agents: [column('id', 'uuid'), column('display_name', 'text')],
  tickets: [
    column('id', 'uuid'),
    column('number', 'text'),
    column('subject', 'text'),
    column('organization_id', 'uuid'),
    column('status', 'text'),
    column('assignee_id', 'uuid', true),
    column('created_at', 'timestamp(3) with time zone'),
    column('updated_at', 'timestamp(3) with time zone'),
  ],
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');

// Include definitions and validity flags, not just names or the migration checksum.
async function schemaShape(client) {
  const tables = (
    await client.query(`SELECT c.relname AS table_name, c.relkind AS kind,
    c.relrowsecurity AS row_security, c.relforcerowsecurity AS force_row_security
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'platypus' AND c.relkind <> 'i'
    ORDER BY c.relname COLLATE "C"`)
  ).rows;
  requireValue(
    same(
      tables.map((r) => r.table_name),
      tableNames,
    ) &&
      tables.every(
        (r) => r.kind === 'r' && !r.row_security && !r.force_row_security,
      ),
    'The target table inventory differs from the reviewed schema.',
  );
  const columns = (
    await client.query(`SELECT c.relname AS table_name, a.attname AS column_name,
    format_type(a.atttypid, a.atttypmod) AS type_name, a.attnotnull AS not_null,
    pg_get_expr(d.adbin, d.adrelid) AS default_expression,
    a.attidentity AS identity_kind, a.attgenerated AS generated_kind
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE n.nspname = 'platypus' AND c.relkind = 'r' AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname COLLATE "C", a.attnum`)
  ).rows;
  const expected = tableNames.flatMap((name) =>
    expectedColumns[name].map((c) => ({
      table_name: name,
      ...c,
      identity_kind: '',
      generated_kind: '',
    })),
  );
  requireValue(
    same(columns, expected),
    'The target columns differ from the reviewed schema.',
  );
  const checks = (
    await client.query(`SELECT c.relname AS table_name, x.conname AS constraint_name,
    x.contype AS constraint_type, pg_get_constraintdef(x.oid, false) AS definition,
    x.convalidated AS validated, x.condeferrable AS deferrable, x.condeferred AS deferred,
    x.conenforced AS enforced, x.conkey::text AS column_numbers
    FROM pg_constraint x JOIN pg_class c ON c.oid = x.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'platypus'
    ORDER BY c.relname COLLATE "C", x.conname COLLATE "C"`)
  ).rows;
  const expectedChecks = tableNames
    .flatMap((name) =>
      Object.entries(constraints[name]).map(
        ([constraint_name, constraint_type]) => ({
          table_name: name,
          constraint_name,
          constraint_type,
        }),
      ),
    )
    .sort(
      (a, b) =>
        a.table_name.localeCompare(b.table_name, 'en') ||
        a.constraint_name.localeCompare(b.constraint_name, 'en'),
    );
  requireValue(
    same(
      checks
        .filter((row) => row.constraint_type !== 'n')
        .map(({ table_name, constraint_name, constraint_type }) => ({
          table_name,
          constraint_name,
          constraint_type,
        })),
      expectedChecks,
    ) &&
      checks.every(
        (c) =>
          c.validated &&
          c.enforced &&
          !c.deferrable &&
          !c.deferred &&
          typeof c.definition === 'string',
      ),
    'The target constraints differ from the reviewed schema.',
  );
  const expectedNotNull = tableNames
    .flatMap((name) =>
      expectedColumns[name]
        .map((c, position) =>
          c.not_null ? name + ':' + '{' + (position + 1) + '}' : null,
        )
        .filter(Boolean),
    )
    .sort();
  const actualNotNull = checks
    .filter((c) => c.constraint_type === 'n')
    .map((c) => c.table_name + ':' + c.column_numbers)
    .sort();
  requireValue(
    same(actualNotNull, expectedNotNull),
    'The target not-null constraints differ from the reviewed schema.',
  );
  const indexes = (
    await client.query(`SELECT i.relname AS index_name, c.relname AS table_name,
    pg_get_indexdef(i.oid) AS definition, x.indisvalid AS valid, x.indisready AS ready,
    x.indisunique AS unique_index, x.indisprimary AS primary_index
    FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class c ON c.oid = x.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'platypus' ORDER BY i.relname COLLATE "C"`)
  ).rows;
  requireValue(
    same(
      indexes.map((i) => i.index_name),
      indexNames,
    ) &&
      indexes.every(
        (i) => i.valid && i.ready && typeof i.definition === 'string',
      ),
    'The target indexes differ from the reviewed schema.',
  );
  const triggers = (
    await client.query(`SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'platypus' AND NOT t.tgisinternal`)
  ).rows;
  requireValue(
    triggers.length === 0,
    'Unexpected target triggers are not permitted.',
  );
  return hash({ tables, columns, checks, indexes });
}

async function transaction(client, readOnly, work) {
  let began = false;
  let committing = false;
  try {
    await client.query(
      readOnly
        ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'
        : 'BEGIN ISOLATION LEVEL REPEATABLE READ',
    );
    began = true;
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '45s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '60s'");
    await client.query('SET LOCAL search_path = pg_catalog');
    const result = await work(client);
    committing = true;
    await client.query('COMMIT');
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* The caller owns closing a failed connection. */
      }
    }
    if (committing)
      throw new TransferError(
        'The commit result is unknown. Explicitly verify the target before any retry.',
      );
    if (error instanceof TransferError) throw error;
    throw new TransferError(
      'The migration transaction failed. No automatic retry was attempted.',
    );
  }
}

async function identity(snapshot) {
  const validated = await validateSnapshot(snapshot);
  return {
    snapshot: validated,
    artifactSha256: snapshotSha256(await encodeSnapshot(validated)),
    dataSha256: dataFingerprint(validated),
  };
}

function counts(snapshot) {
  return Object.fromEntries(
    Object.entries(snapshot.data).map(([name, rows]) => [name, rows.length]),
  );
}

async function representativeQueries(client, snapshot) {
  const expected = snapshot.data.tickets;
  const samples = (
    await client.query(`SELECT t.id, o.display_name AS organization_name, a.display_name AS assignee_name
    FROM platypus.tickets t JOIN platypus.organizations o ON o.id = t.organization_id
    LEFT JOIN platypus.support_agents a ON a.id = t.assignee_id ORDER BY t.id LIMIT 25`)
  ).rows;
  const organizations = new Map(
    snapshot.data.organizations.map((r) => [r.id, r.display_name]),
  );
  const agents = new Map(
    snapshot.data.support_agents.map((r) => [r.id, r.display_name]),
  );
  requireValue(
    same(
      samples,
      expected.slice(0, 25).map((r) => ({
        id: r.id,
        organization_name: organizations.get(r.organization_id),
        assignee_name:
          r.assignee_id === null ? null : agents.get(r.assignee_id),
      })),
    ),
    'Representative directory queries differ from the imported data.',
  );
  const status = expected[0]?.status ?? 'New';
  const filtered = (
    await client.query(
      `SELECT id FROM platypus.tickets WHERE status = $1
    ORDER BY created_at DESC, id LIMIT 25`,
      [status],
    )
  ).rows;
  const ordered = expected
    .filter((r) => r.status === status)
    .sort(
      (a, b) =>
        b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id),
    )
    .slice(0, 25)
    .map((r) => ({ id: r.id }));
  requireValue(
    same(filtered, ordered),
    'Representative bounded ticket queries differ from the imported data.',
  );
}

async function verifyInTransaction(client, input, expectedShape) {
  const { snapshot, artifactSha256, dataSha256 } = input;
  await client.query(
    'LOCK TABLE platypus.migration_imports, platypus.organizations, platypus.schema_migrations, platypus.seed_runs, platypus.support_agents, platypus.tickets IN ACCESS SHARE MODE',
  );
  const shape = await schemaShape(client);
  const ledger = (
    await client.query(`SELECT singleton, artifact_sha256, data_sha256, schema_sha256,
    index_sha256, shape_sha256 FROM platypus.migration_imports ORDER BY singleton`)
  ).rows;
  requireValue(
    ledger.length === 1 &&
      ledger[0].singleton === true &&
      ledger[0].artifact_sha256 === artifactSha256 &&
      ledger[0].data_sha256 === dataSha256 &&
      ledger[0].schema_sha256 === snapshot.schemaSha256 &&
      ledger[0].index_sha256 === snapshot.indexSha256 &&
      ledger[0].shape_sha256 === shape &&
      (!expectedShape || shape === expectedShape),
    'The target import ledger or schema differs from this exact snapshot.',
  );
  const migrations = (
    await client.query(
      'SELECT version, checksum FROM platypus.schema_migrations ORDER BY version',
    )
  ).rows;
  requireValue(
    same(migrations, [{ version: '001', checksum: snapshot.schemaSha256 }]),
    'The target migration ledger is not the reviewed migration001.',
  );
  const seeds = (
    await client.query(
      'SELECT seed_key, checksum FROM platypus.seed_runs ORDER BY seed_key',
    )
  ).rows;
  requireValue(
    seeds.length === 0,
    'Imported data must not claim regenerated seed provenance.',
  );
  const actual = await readSnapshot(client);
  requireValue(
    dataFingerprint(actual) === dataSha256 &&
      same(counts(actual), counts(snapshot)),
    'Target content differs from the exact snapshot.',
  );
  await representativeQueries(client, snapshot);
  return { artifactSha256, dataSha256, counts: counts(snapshot) };
}

async function insertRows(client, table, rows, names) {
  for (let start = 0; start < rows.length; start += 1000) {
    const batch = rows.slice(start, start + 1000);
    const values = batch.flatMap((row) => names.map((name) => row[name]));
    const placeholders = batch
      .map(
        (_, row) =>
          `(${names.map((_, col) => `$${row * names.length + col + 1}`).join(', ')})`,
      )
      .join(', ');
    await client.query(
      `INSERT INTO platypus.${table} (${names.join(', ')}) VALUES ${placeholders}`,
      values,
    );
  }
}

export async function exportDatabase(client) {
  return transaction(client, true, () => readSnapshot(client));
}

export async function verifyDatabase(client, snapshot) {
  const input = await identity(snapshot);
  return transaction(client, true, async () => ({
    verified: true,
    ...(await verifyInTransaction(client, input)),
  }));
}

export async function importDatabase(client, candidate) {
  const input = await identity(candidate);
  const snapshot = input.snapshot;
  const schema = await loadSchema();
  requireValue(
    schema.schemaSha256 === snapshot.schemaSha256 &&
      schema.indexSha256 === snapshot.indexSha256,
    'The reviewed schema files changed after snapshot validation. No SQL was executed.',
  );
  return transaction(client, false, async () => {
    const lock = (
      await client.query(
        'SELECT pg_try_advisory_xact_lock(182746, 76001) AS acquired',
      )
    ).rows;
    requireValue(
      lock.length === 1 && lock[0].acquired === true,
      'Another migration holds the target import lock.',
    );
    const exists = (
      await client.query(
        "SELECT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'platypus') AS present",
      )
    ).rows;
    if (exists[0]?.present) {
      // Unknown existing schemas are never adopted or repaired.
      return { imported: false, ...(await verifyInTransaction(client, input)) };
    }
    await client.query('CREATE SCHEMA platypus');
    await client.query(`CREATE TABLE platypus.schema_migrations (version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE platypus.seed_runs (seed_key text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
      CREATE TABLE platypus.migration_imports (singleton boolean PRIMARY KEY CHECK (singleton), artifact_sha256 text NOT NULL,
        data_sha256 text NOT NULL, schema_sha256 text NOT NULL, index_sha256 text NOT NULL, shape_sha256 text NOT NULL,
        imported_at timestamptz NOT NULL DEFAULT now())`);
    await client.query(schema.schemaSql);
    await insertRows(client, 'organizations', snapshot.data.organizations, [
      'id',
      'display_name',
    ]);
    await insertRows(client, 'support_agents', snapshot.data.support_agents, [
      'id',
      'display_name',
    ]);
    await insertRows(client, 'tickets', snapshot.data.tickets, [
      'id',
      'number',
      'subject',
      'organization_id',
      'status',
      'assignee_id',
      'created_at',
      'updated_at',
    ]);
    await client.query(schema.indexSql);
    await client.query(
      'INSERT INTO platypus.schema_migrations(version, checksum) VALUES ($1, $2)',
      ['001', snapshot.schemaSha256],
    );
    const shape = await schemaShape(client);
    await client.query(
      `INSERT INTO platypus.migration_imports(singleton, artifact_sha256, data_sha256, schema_sha256, index_sha256, shape_sha256)
      VALUES (true, $1, $2, $3, $4, $5)`,
      [
        input.artifactSha256,
        input.dataSha256,
        snapshot.schemaSha256,
        snapshot.indexSha256,
        shape,
      ],
    );
    const checked = await verifyInTransaction(client, input, shape);
    return { imported: true, ...checked };
  });
}
