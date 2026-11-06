import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  generateLargeDataset,
  datasetChecksums,
  LARGE_COUNTS,
  LARGE_SEED_KEY,
} from './dataset.mjs';

const INDEX_KEY = 'tickets-large-indexes-v1';
const DEFINITIONS_KEY = 'tickets-large-index-definitions-v1';
const indexNames = [
  'large_tickets_number_order_idx',
  'large_tickets_created_order_idx',
  'large_tickets_updated_order_idx',
  'large_tickets_status_created_idx',
  'large_tickets_organization_created_idx',
  'large_tickets_assignee_created_idx',
].sort();
const checksum = (text) => createHash('sha256').update(text).digest('hex');
export class LargeSetupError extends Error {}
function required(condition, message) {
  if (!condition) throw new LargeSetupError(message);
}

export async function assertLargeTarget(client, environment = process.env) {
  const database = (await client.query('SELECT current_database() AS name'))
    .rows[0]?.name;
  required(
    ['platypus_service_large', 'platypus_service_large_test'].includes(
      database,
    ),
    'Only the explicitly named large project databases are allowed.',
  );
  if (database === 'platypus_service_large_test') {
    required(
      environment.PLATYPUS_LARGE_TEST_OWNED === '1',
      'The large disposable test database requires explicit ownership acknowledgment.',
    );
    const marker = (
      await client.query('SELECT marker FROM public.platypus_test_ownership')
    ).rows;
    required(
      marker.length === 1 &&
        marker[0].marker === 'platypus-service-large-disposable-tests',
      'The large disposable database ownership marker is missing or different.',
    );
  }
  return database;
}

async function files() {
  const [schema, indexes] = await Promise.all([
    readFile(new URL('../001.sql', import.meta.url), 'utf8'),
    readFile(new URL('./indexes.sql', import.meta.url), 'utf8'),
  ]);
  const indexSql = indexes.replaceAll('\r\n', '\n');
  return {
    schemaChecksum: checksum(schema.replaceAll('\r\n', '\n')),
    indexSql,
    indexChecksum: checksum(indexSql),
  };
}

async function checkedSchema(client, expected) {
  const rows = (
    await client.query(
      'SELECT version, checksum FROM platypus.schema_migrations ORDER BY version',
    )
  ).rows;
  required(
    rows.length === 1 &&
      rows[0].version === '001' &&
      rows[0].checksum === expected.schemaChecksum,
    'Apply the unchanged expected migration001 before loading the large dataset.',
  );
}

async function definitions(client) {
  const rows = (
    await client.query(
      `SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'platypus' AND indexname = ANY($1::text[]) ORDER BY indexname COLLATE "C"`,
      [indexNames],
    )
  ).rows;
  return { rows, checksum: checksum(JSON.stringify(rows)) };
}

async function ledger(client) {
  return (
    await client.query(
      'SELECT seed_key, checksum FROM platypus.seed_runs ORDER BY seed_key COLLATE "C"',
    )
  ).rows;
}

function expectedLedger(rows, inputChecksum, expected, currentDefinitions) {
  required(
    rows.length === 3 &&
      rows.some(
        (row) =>
          row.seed_key === LARGE_SEED_KEY && row.checksum === inputChecksum,
      ) &&
      rows.some(
        (row) =>
          row.seed_key === INDEX_KEY && row.checksum === expected.indexChecksum,
      ) &&
      rows.some(
        (row) =>
          row.seed_key === DEFINITIONS_KEY &&
          row.checksum === currentDefinitions.checksum,
      ) &&
      currentDefinitions.rows.length === indexNames.length,
    'Large seed or index provenance is incomplete, changed or belongs to different data.',
  );
}

async function withClient(pool, readOnly, work) {
  const client = await pool.connect();
  let discard;
  let began = false;
  try {
    const database = await assertLargeTarget(client);
    await client.query(
      readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN',
    );
    began = true;
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '5s'");
    if (!readOnly)
      await client.query('SELECT pg_advisory_xact_lock(182746, 53001)');
    const result = await work(client, database);
    await client.query('COMMIT');
    began = false;
    return result;
  } catch (error) {
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        discard = rollbackError;
      }
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

export async function seedLarge(pool) {
  const expected = await files();
  const dataset = generateLargeDataset();
  const hashes = datasetChecksums(dataset);
  const started = performance.now();
  return withClient(pool, false, async (client, database) => {
    await checkedSchema(client, expected);
    const recorded = await ledger(client);
    const currentDefinitions = await definitions(client);
    if (recorded.length > 0) {
      expectedLedger(recorded, hashes.seed, expected, currentDefinitions);
      return {
        applied: false,
        database,
        seedKey: LARGE_SEED_KEY,
        checksum: hashes.seed,
        elapsedMs: Math.round(performance.now() - started),
      };
    }
    required(
      currentDefinitions.rows.length === 0,
      'Refusing to adopt unrecorded large query indexes.',
    );
    const count = (
      await client.query(
        `SELECT (SELECT count(*) FROM platypus.organizations) + (SELECT count(*) FROM platypus.support_agents) + (SELECT count(*) FROM platypus.tickets) AS count`,
      )
    ).rows[0].count;
    required(
      Number(count) === 0,
      'Large first seed requires empty business tables; existing data is never reset or adopted.',
    );
    for (const [table, entries] of [
      ['organizations', dataset.organizations],
      ['support_agents', dataset.supportAgents],
    ]) {
      const inserted = await client.query(
        `INSERT INTO platypus.${table}(id, display_name) SELECT * FROM unnest($1::uuid[], $2::text[])`,
        [entries.map((row) => row.id), entries.map((row) => row.displayName)],
      );
      required(
        inserted.rowCount === entries.length,
        'Directory insertion was incomplete; refusing partial seed.',
      );
    }
    for (let start = 0; start < dataset.tickets.length; start += 1000) {
      const batch = dataset.tickets.slice(start, start + 1000);
      const keys = [
        'id',
        'number',
        'subject',
        'organizationId',
        'status',
        'assigneeId',
        'createdAt',
        'updatedAt',
      ];
      const inserted = await client.query(
        `INSERT INTO platypus.tickets(id, number, subject, organization_id, status, assignee_id, created_at, updated_at)
        SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::uuid[], $5::text[], $6::uuid[], $7::timestamptz[], $8::timestamptz[])`,
        keys.map((key) => batch.map((row) => row[key])),
      );
      required(
        inserted.rowCount === batch.length,
        'Ticket batch insertion was incomplete; refusing partial seed.',
      );
    }
    await client.query(expected.indexSql);
    await client.query(
      'ANALYZE platypus.organizations, platypus.support_agents, platypus.tickets',
    );
    const createdDefinitions = await definitions(client);
    required(
      createdDefinitions.rows.length === indexNames.length,
      'Expected large query indexes were not created.',
    );
    for (const [key, value] of [
      [LARGE_SEED_KEY, hashes.seed],
      [INDEX_KEY, expected.indexChecksum],
      [DEFINITIONS_KEY, createdDefinitions.checksum],
    ])
      await client.query(
        'INSERT INTO platypus.seed_runs(seed_key, checksum) VALUES ($1, $2)',
        [key, value],
      );
    return {
      applied: true,
      database,
      seedKey: LARGE_SEED_KEY,
      checksum: hashes.seed,
      counts: LARGE_COUNTS,
      elapsedMs: Math.round(performance.now() - started),
    };
  });
}

async function contentChecksums(client) {
  const directory = async (table) =>
    (
      await client.query(
        `SELECT encode(sha256(convert_to(COALESCE(string_agg(id::text || chr(31) || display_name || chr(10), '' ORDER BY id), ''), 'UTF8')), 'hex') AS checksum FROM platypus.${table}`,
      )
    ).rows[0].checksum;
  const tickets = (
    await client.query(`SELECT encode(sha256(convert_to(COALESCE(string_agg(
    concat_ws(chr(31), id::text, number, subject, organization_id::text, status, COALESCE(assignee_id::text, ''),
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) || chr(10), ''
    ORDER BY length(substring(number FROM 4)), substring(number FROM 4) COLLATE "C"), ''), 'UTF8')), 'hex') AS checksum FROM platypus.tickets`)
  ).rows[0].checksum;
  return {
    organizations: await directory('organizations'),
    supportAgents: await directory('support_agents'),
    tickets,
  };
}

export async function verifyLarge(pool) {
  const expected = await files();
  const hashes = datasetChecksums(generateLargeDataset());
  const started = performance.now();
  return withClient(pool, true, async (client, database) => {
    await checkedSchema(client, expected);
    const currentDefinitions = await definitions(client);
    expectedLedger(
      await ledger(client),
      hashes.seed,
      expected,
      currentDefinitions,
    );
    const count = (
      await client.query(`SELECT (SELECT count(*) FROM platypus.organizations) AS organizations,
      (SELECT count(*) FROM platypus.support_agents) AS support_agents, count(*) AS tickets,
      count(*) FILTER (WHERE assignee_id IS NULL) AS unassigned,
      min(created_at) AS created_from, max(created_at) AS created_to FROM platypus.tickets`)
    ).rows[0];
    const counts = {
      organizations: Number(count.organizations),
      supportAgents: Number(count.support_agents),
      tickets: Number(count.tickets),
    };
    required(
      Object.keys(LARGE_COUNTS).every(
        (key) => counts[key] === LARGE_COUNTS[key],
      ),
      'Large dataset counts differ; verification never repairs data.',
    );
    const checksums = await contentChecksums(client);
    const statuses = (
      await client.query(
        'SELECT status, count(*)::integer AS count FROM platypus.tickets GROUP BY status ORDER BY status COLLATE "C"',
      )
    ).rows;
    return {
      database,
      seedKey: LARGE_SEED_KEY,
      counts,
      unassigned: Number(count.unassigned),
      statuses,
      createdFrom: count.created_from.toISOString(),
      createdTo: count.created_to.toISOString(),
      checksums,
      contentMatchesSeed: ['organizations', 'supportAgents', 'tickets'].every(
        (key) => checksums[key] === hashes[key],
      ),
      indexes: currentDefinitions.rows.map((row) => row.indexname),
      elapsedMs: Math.round(performance.now() - started),
    };
  });
}
