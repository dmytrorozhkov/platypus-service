import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const statuses = new Set(['New', 'In progress', 'Awaiting customer', 'Closed']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const seedKey = 'tickets-demo-v1';
const digest = (value) => createHash('sha256').update(value).digest('hex');

class SetupError extends Error {}

function requireValue(condition, message) {
  if (!condition) throw new SetupError(message);
}

function nonblank(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function instant(value) {
  requireValue(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
        value,
      ) &&
      Number.isFinite(Date.parse(value)),
    'Seed timestamps must be finite explicit-offset instants.',
  );
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  requireValue(
    month >= 1 &&
      month <= 12 &&
      day >= 1 &&
      day <= days[month - 1] &&
      Number(value.slice(11, 13)) < 24 &&
      Number(value.slice(14, 16)) < 60 &&
      Number(value.slice(17, 19)) < 60,
    'Seed timestamp contains an invalid calendar date or clock time.',
  );
  return new Date(value).toISOString();
}

function directoryEntries(entries, kind) {
  requireValue(
    Array.isArray(entries) && entries.length > 0,
    `Invalid ${kind} directory.`,
  );
  const keys = new Set();
  const ids = new Set();
  return entries
    .map((entry) => {
      const id = typeof entry?.id === 'string' ? entry.id.toLowerCase() : '';
      requireValue(
        entry &&
          nonblank(entry.seedKey) &&
          nonblank(entry.displayName) &&
          uuid.test(id) &&
          !keys.has(entry.seedKey) &&
          !ids.has(id),
        `Invalid or duplicate ${kind} identity.`,
      );
      keys.add(entry.seedKey);
      ids.add(id);
      return { seedKey: entry.seedKey, id, displayName: entry.displayName };
    })
    .sort((a, b) => a.seedKey.localeCompare(b.seedKey, 'en'));
}

export function validateSeedInput(tickets, identities) {
  requireValue(
    Array.isArray(tickets) && tickets.length > 0 && identities,
    'Invalid seed input.',
  );
  const organizations = directoryEntries(
    identities.organizations,
    'organization',
  );
  const supportAgents = directoryEntries(
    identities.supportAgents,
    'support agent',
  );
  const organizationsByKey = new Map(
    organizations.map((entry) => [entry.seedKey, entry]),
  );
  const agentsByKey = new Map(
    supportAgents.map((entry) => [entry.seedKey, entry]),
  );
  requireValue(Array.isArray(identities.tickets), 'Invalid ticket identities.');
  const ticketMap = new Map();
  const ticketIds = new Set();
  for (const entry of identities.tickets) {
    const id = typeof entry?.id === 'string' ? entry.id.toLowerCase() : '';
    requireValue(
      entry &&
        uuid.test(id) &&
        !ticketMap.has(entry.number) &&
        !ticketIds.has(id),
      'Invalid or duplicate ticket identity.',
    );
    ticketMap.set(entry.number, { ...entry, id });
    ticketIds.add(id);
  }
  requireValue(
    ticketMap.size === tickets.length,
    'Ticket identity coverage differs from the fixture.',
  );
  const seen = new Set();
  const rows = tickets
    .map((ticket) => {
      requireValue(
        ticket &&
          /^PS-[1-9][0-9]*$/.test(ticket.number) &&
          !seen.has(ticket.number) &&
          nonblank(ticket.subject) &&
          nonblank(ticket.organization) &&
          statuses.has(ticket.status) &&
          (ticket.assignee === null || nonblank(ticket.assignee)),
        'Invalid or duplicate fixture ticket.',
      );
      const identity = ticketMap.get(ticket.number);
      const organization = organizationsByKey.get(identity?.organizationKey);
      const agent =
        identity?.assigneeKey === null
          ? null
          : agentsByKey.get(identity?.assigneeKey);
      requireValue(
        organization?.displayName === ticket.organization &&
          (ticket.assignee === null
            ? agent === null
            : agent?.displayName === ticket.assignee),
        'Fixture directory references do not match explicit identities.',
      );
      const createdAt = instant(ticket.createdAt);
      const updatedAt = instant(ticket.updatedAt);
      requireValue(
        createdAt <= updatedAt,
        'Seed updatedAt precedes createdAt.',
      );
      seen.add(ticket.number);
      return {
        id: identity.id,
        number: ticket.number,
        subject: ticket.subject,
        organizationId: organization.id,
        status: ticket.status,
        assigneeId: agent?.id ?? null,
        createdAt,
        updatedAt,
      };
    })
    .sort((a, b) => a.number.localeCompare(b.number, 'en'));
  const content = { organizations, supportAgents, tickets: rows };
  return { ...content, seedKey, checksum: digest(JSON.stringify(content)) };
}

export async function loadSeedInput({
  fixturePath = path.join(directory, '../src/fixtures/tickets.json'),
  identitiesPath = path.join(directory, 'seed-identities.json'),
} = {}) {
  const [fixture, identities] = await Promise.all([
    readFile(fixturePath, 'utf8'),
    readFile(identitiesPath, 'utf8'),
  ]);
  return validateSeedInput(JSON.parse(fixture), JSON.parse(identities));
}

async function migrationsFrom(migrationsDirectory = directory) {
  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d{3}\.sql$/.test(name))
    .sort();
  requireValue(names.length > 0, 'No numbered migrations were found.');
  return Promise.all(
    names.map(async (name) => {
      const sql = (
        await readFile(path.join(migrationsDirectory, name), 'utf8')
      ).replaceAll('\r\n', '\n');
      requireValue(
        sql.trim().length > 0,
        'An empty migration is not permitted.',
      );
      return { version: name.slice(0, 3), sql, checksum: digest(sql) };
    }),
  );
}

async function transaction(pool, work) {
  const client = await pool.connect();
  let discard;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query('SELECT pg_advisory_xact_lock(182746, 53001)');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      discard = rollbackError;
    }
    throw error;
  } finally {
    client.release(discard);
  }
}

function checkApplied(applied, migrations) {
  for (const row of applied) {
    const file = migrations.find(
      (migration) => migration.version === row.version,
    );
    requireValue(
      file && file.checksum === row.checksum,
      'Applied migration is missing, changed or newer than this checkout.',
    );
  }
  const pending = migrations.filter(
    (migration) => !applied.some((row) => row.version === migration.version),
  );
  const latest = applied.at(-1)?.version;
  requireValue(
    !latest || pending.every((migration) => migration.version > latest),
    'A migration was inserted before an applied version.',
  );
  return pending;
}

export async function migrate(pool, { migrationsDirectory } = {}) {
  const migrations = await migrationsFrom(migrationsDirectory);
  return transaction(pool, async (client) => {
    await client.query('CREATE SCHEMA IF NOT EXISTS platypus');
    await client.query(`CREATE TABLE IF NOT EXISTS platypus.schema_migrations (
      version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    await client.query(`CREATE TABLE IF NOT EXISTS platypus.seed_runs (
      seed_key text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const applied = (
      await client.query(
        'SELECT version, checksum FROM platypus.schema_migrations ORDER BY version',
      )
    ).rows;
    const pending = checkApplied(applied, migrations);
    for (const migration of pending) {
      await client.query(migration.sql);
      await client.query(
        'INSERT INTO platypus.schema_migrations(version, checksum) VALUES ($1, $2)',
        [migration.version, migration.checksum],
      );
    }
    return { applied: pending.map((migration) => migration.version) };
  });
}

export async function seed(pool, options = {}) {
  const input = await loadSeedInput(options);
  const migrations = await migrationsFrom(options.migrationsDirectory);
  return transaction(pool, async (client) => {
    const applied = (
      await client.query(
        'SELECT version, checksum FROM platypus.schema_migrations ORDER BY version',
      )
    ).rows;
    requireValue(
      checkApplied(applied, migrations).length === 0,
      'Apply all migrations before seeding.',
    );
    const recorded = (
      await client.query(
        'SELECT checksum FROM platypus.seed_runs WHERE seed_key = $1',
        [input.seedKey],
      )
    ).rows[0];
    if (recorded) {
      requireValue(
        recorded.checksum === input.checksum,
        'Seed checksum differs from the recorded seed.',
      );
      return {
        applied: false,
        seedKey: input.seedKey,
        checksum: input.checksum,
      };
    }
    const count = (
      await client.query(`SELECT
      (SELECT count(*) FROM platypus.organizations) +
      (SELECT count(*) FROM platypus.support_agents) +
      (SELECT count(*) FROM platypus.tickets) AS count`)
    ).rows[0].count;
    requireValue(
      Number(count) === 0,
      'First seed requires empty business tables; partial data will not be repaired.',
    );
    for (const entry of input.organizations)
      await client.query(
        'INSERT INTO platypus.organizations(id, display_name) VALUES ($1, $2)',
        [entry.id, entry.displayName],
      );
    for (const entry of input.supportAgents)
      await client.query(
        'INSERT INTO platypus.support_agents(id, display_name) VALUES ($1, $2)',
        [entry.id, entry.displayName],
      );
    for (const row of input.tickets) {
      await client.query(
        `INSERT INTO platypus.tickets
        (id, number, subject, organization_id, status, assignee_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          row.id,
          row.number,
          row.subject,
          row.organizationId,
          row.status,
          row.assigneeId,
          row.createdAt,
          row.updatedAt,
        ],
      );
    }
    await client.query(
      'INSERT INTO platypus.seed_runs(seed_key, checksum) VALUES ($1, $2)',
      [input.seedKey, input.checksum],
    );
    return { applied: true, seedKey: input.seedKey, checksum: input.checksum };
  });
}

export async function check(pool) {
  const migrations = await migrationsFrom();
  const client = await pool.connect();
  try {
    const applied = (
      await client.query(
        'SELECT version, checksum FROM platypus.schema_migrations ORDER BY version',
      )
    ).rows;
    requireValue(
      checkApplied(applied, migrations).length === 0,
      'Database schema is not current.',
    );
    await client.query('SELECT number FROM platypus.tickets LIMIT 1');
    return { schema: 'current', readable: true };
  } finally {
    client.release();
  }
}

export function explicitConnectionFromEnvironment(environment = process.env) {
  for (const key of [
    'PGHOST',
    'PGPORT',
    'PGDATABASE',
    'PGUSER',
    'PGPASSWORD',
  ]) {
    requireValue(
      nonblank(environment[key]),
      `${key} must be explicitly configured.`,
    );
  }
  requireValue(
    /^\d+$/.test(environment.PGPORT) &&
      Number(environment.PGPORT) > 0 &&
      Number(environment.PGPORT) <= 65535,
    'PGPORT must be a valid port.',
  );
  return {
    host: environment.PGHOST,
    port: Number(environment.PGPORT),
    database: environment.PGDATABASE,
    user: environment.PGUSER,
    password: environment.PGPASSWORD,
    max: 2,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
    application_name: 'platypus-explicit-setup',
  };
}

async function main() {
  requireValue(
    process.argv.length === 3 &&
      ['migrate', 'seed', 'check'].includes(process.argv[2]),
    'Choose exactly one explicit operation: migrate, seed or check.',
  );
  const config = explicitConnectionFromEnvironment();
  const { Pool } = await import('pg');
  const pool = new Pool(config);
  pool.on('error', () => console.error('Database setup connection failed.'));
  try {
    console.log(
      JSON.stringify(await { migrate, seed, check }[process.argv[2]](pool)),
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
      'Database setup failed.',
      error instanceof SetupError
        ? error.message
        : /^[A-Z0-9]{5}$/.test(error?.code)
          ? error.code
          : 'Check the explicit setup command, configuration and schema.',
    );
    process.exitCode = 1;
  });
}
