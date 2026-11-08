import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { TextDecoder } from 'node:util';

export const MAX_SNAPSHOT_BYTES = 134217728;
const FORMAT = 'platypus-neon-data-v1';
const MAX_DIRECTORY = 10000;
const MAX_TICKETS = 100000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const shaPattern = /^[0-9a-f]{64}$/;
const timestampPattern =
  /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const statuses = new Set(['New', 'In progress', 'Awaiting customer', 'Closed']);
const snapshotKeys = ['format', 'schemaSha256', 'indexSha256', 'data'];
const dataKeys = ['organizations', 'support_agents', 'tickets'];
const directoryKeys = ['id', 'display_name'];
const ticketKeys = [
  'id',
  'number',
  'subject',
  'organization_id',
  'status',
  'assignee_id',
  'created_at',
  'updated_at',
];

export class SnapshotError extends Error {}

function requireValue(condition, message = 'Invalid migration snapshot.') {
  if (!condition) throw new SnapshotError(message);
}

function exactObject(value, keys) {
  requireValue(
    value !== null &&
      typeof value === 'object' &&
      Object.getPrototypeOf(value) === Object.prototype,
  );
  const actual = Reflect.ownKeys(value);
  requireValue(
    actual.length === keys.length && actual.every((key) => keys.includes(key)),
  );
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    requireValue(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable,
    );
  }
}

function array(value, maximum) {
  requireValue(Array.isArray(value) && value.length <= maximum);
  requireValue(Reflect.ownKeys(value).length === value.length + 1);
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    requireValue(
      descriptor && Object.hasOwn(descriptor, 'value') && descriptor.enumerable,
    );
  }
}

function string(value, budget, nonblank = false) {
  requireValue(
    typeof value === 'string' &&
      value.isWellFormed() &&
      !value.includes('\u0000'),
  );
  if (nonblank) requireValue(value.trim().length > 0);
  // Count escaping without first allocating a potentially oversized escaped string.
  requireValue(
    value.length <= MAX_SNAPSHOT_BYTES &&
      Buffer.byteLength(value, 'utf8') <= budget.remaining,
  );
  let bytes = Buffer.byteLength(value, 'utf8') + 2;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code === 34 || code === 92 || [8, 9, 10, 12, 13].includes(code))
      bytes += 1;
    else if (code < 32) bytes += 5;
  }
  budget.remaining -= bytes;
  requireValue(
    budget.remaining >= 0,
    'Migration snapshot exceeds its byte limit.',
  );
  return value;
}

function id(value, budget) {
  requireValue(typeof value === 'string' && uuidPattern.test(value));
  return string(value, budget);
}

function instant(value, budget) {
  requireValue(typeof value === 'string' && timestampPattern.test(value));
  const milliseconds = Date.parse(value);
  requireValue(
    Number.isFinite(milliseconds) &&
      new Date(milliseconds).toISOString() === value,
  );
  return string(value, budget);
}

function rows(value, maximum, keys, makeRow, sort, budget) {
  array(value, maximum);
  const structureBytes =
    2 * keys.length +
    1 +
    keys.reduce(
      (total, key) => total + Buffer.byteLength(JSON.stringify(key)),
      0,
    );
  budget.remaining -=
    value.length * structureBytes + Math.max(0, value.length - 1);
  requireValue(
    budget.remaining >= 0,
    'Migration snapshot exceeds its byte limit.',
  );
  const ids = new Set();
  const result = [];
  let previous;
  for (const row of value) {
    exactObject(row, keys);
    const entry = makeRow(row);
    requireValue(!ids.has(entry.id), 'Duplicate migration identity.');
    ids.add(entry.id);
    if (!sort && previous !== undefined)
      requireValue(
        previous < entry.id,
        'Migration rows must be sorted by identity.',
      );
    previous = entry.id;
    result.push(Object.freeze(entry));
  }
  if (sort)
    result.sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );
  return { entries: Object.freeze(result), ids };
}

function canonicalData(data, sort = false) {
  exactObject(data, dataKeys);
  const emptyBytes = Buffer.byteLength(
    JSON.stringify({
      format: FORMAT,
      schemaSha256: '0'.repeat(64),
      indexSha256: '0'.repeat(64),
      data: { organizations: [], support_agents: [], tickets: [] },
    }),
  );
  const budget = { remaining: MAX_SNAPSHOT_BYTES - emptyBytes };
  const directory = (value) => ({
    id: id(value.id, budget),
    display_name: string(value.display_name, budget, true),
  });
  const organizations = rows(
    data.organizations,
    MAX_DIRECTORY,
    directoryKeys,
    directory,
    sort,
    budget,
  );
  const agents = rows(
    data.support_agents,
    MAX_DIRECTORY,
    directoryKeys,
    directory,
    sort,
    budget,
  );
  const numbers = new Set();
  const tickets = rows(
    data.tickets,
    MAX_TICKETS,
    ticketKeys,
    (value) => {
      requireValue(
        typeof value.number === 'string' &&
          /^PS-[1-9][0-9]*$/.test(value.number) &&
          !numbers.has(value.number),
      );
      numbers.add(value.number);
      requireValue(
        organizations.ids.has(value.organization_id) &&
          (value.assignee_id === null || agents.ids.has(value.assignee_id)),
        'Migration references are invalid.',
      );
      requireValue(statuses.has(value.status));
      const created = instant(value.created_at, budget);
      const updated = instant(value.updated_at, budget);
      requireValue(updated >= created);
      if (value.assignee_id === null) {
        budget.remaining -= 4;
        requireValue(
          budget.remaining >= 0,
          'Migration snapshot exceeds its byte limit.',
        );
      }
      return {
        id: id(value.id, budget),
        number: string(value.number, budget),
        subject: string(value.subject, budget, true),
        organization_id: id(value.organization_id, budget),
        status: string(value.status, budget),
        assignee_id:
          value.assignee_id === null ? null : id(value.assignee_id, budget),
        created_at: created,
        updated_at: updated,
      };
    },
    sort,
    budget,
  );
  return Object.freeze({
    organizations: organizations.entries,
    support_agents: agents.entries,
    tickets: tickets.entries,
  });
}

export function snapshotSha256(buffer) {
  requireValue(Buffer.isBuffer(buffer) && buffer.length <= MAX_SNAPSHOT_BYTES);
  return createHash('sha256').update(buffer).digest('hex');
}

export async function loadSchema() {
  const sql = await Promise.all([
    readFile(new URL('../001.sql', import.meta.url), 'utf8'),
    readFile(new URL('../large/indexes.sql', import.meta.url), 'utf8'),
  ]);
  // Match the existing migration runner and keep reviewed schema identity stable across Git line endings.
  const [schemaSql, indexSql] = sql.map((value) =>
    value.replaceAll('\r\n', '\n'),
  );
  return Object.freeze({
    schemaSql,
    indexSql,
    schemaSha256: createHash('sha256').update(schemaSql).digest('hex'),
    indexSha256: createHash('sha256').update(indexSql).digest('hex'),
  });
}

function envelope(snapshot) {
  exactObject(snapshot, snapshotKeys);
  requireValue(
    snapshot.format === FORMAT &&
      typeof snapshot.schemaSha256 === 'string' &&
      shaPattern.test(snapshot.schemaSha256) &&
      typeof snapshot.indexSha256 === 'string' &&
      shaPattern.test(snapshot.indexSha256),
  );
}

function encoded(snapshot) {
  const json = JSON.stringify(snapshot);
  requireValue(
    Buffer.byteLength(json, 'utf8') <= MAX_SNAPSHOT_BYTES,
    'Migration snapshot exceeds its byte limit.',
  );
  return Buffer.from(json, 'utf8');
}

export async function buildSnapshot(data) {
  const schema = await loadSchema();
  const snapshot = Object.freeze({
    format: FORMAT,
    schemaSha256: schema.schemaSha256,
    indexSha256: schema.indexSha256,
    data: canonicalData(data, true),
  });
  encoded(snapshot);
  return snapshot;
}

export async function validateSnapshot(snapshot) {
  envelope(snapshot);
  const schema = await loadSchema();
  requireValue(
    snapshot.schemaSha256 === schema.schemaSha256 &&
      snapshot.indexSha256 === schema.indexSha256,
    'Migration schema digests do not match this version.',
  );
  const validated = Object.freeze({
    format: FORMAT,
    schemaSha256: snapshot.schemaSha256,
    indexSha256: snapshot.indexSha256,
    data: canonicalData(snapshot.data),
  });
  encoded(validated);
  return validated;
}

export async function encodeSnapshot(snapshot) {
  return encoded(await validateSnapshot(snapshot));
}

export async function decodeSnapshot(buffer, expectedSha256) {
  requireValue(
    Buffer.isBuffer(buffer) &&
      buffer.length > 0 &&
      buffer.length <= MAX_SNAPSHOT_BYTES,
    'Migration snapshot exceeds its byte limit or is empty.',
  );
  requireValue(
    typeof expectedSha256 === 'string' &&
      shaPattern.test(expectedSha256) &&
      snapshotSha256(buffer) === expectedSha256,
    'Migration artifact digest does not match.',
  );
  let parsed;
  try {
    parsed = JSON.parse(
      new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer),
    );
  } catch {
    throw new SnapshotError('Migration snapshot is not valid UTF-8 JSON.');
  }
  const validated = await validateSnapshot(parsed);
  requireValue(
    encoded(validated).equals(buffer),
    'Migration snapshot must use canonical encoding.',
  );
  return validated;
}

export function dataFingerprint(snapshot) {
  envelope(snapshot);
  const data = canonicalData(snapshot.data);
  const buffer = encoded({
    format: FORMAT,
    schemaSha256: snapshot.schemaSha256,
    indexSha256: snapshot.indexSha256,
    data,
  });
  // Hash only canonical typed data; structure and escaping make separators unambiguous.
  requireValue(buffer.length <= MAX_SNAPSHOT_BYTES);
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

const budgetSql = `SELECT COALESCE(sum(bytes), 0)::text AS bytes FROM (
  SELECT octet_length(row_to_json(row_data)::text)::bigint AS bytes FROM
    (SELECT id, display_name FROM platypus.organizations ORDER BY id LIMIT 10001) row_data
  UNION ALL
  SELECT octet_length(row_to_json(row_data)::text)::bigint FROM
    (SELECT id, display_name FROM platypus.support_agents ORDER BY id LIMIT 10001) row_data
  UNION ALL
  SELECT octet_length(row_to_json(row_data)::text)::bigint FROM
    (SELECT id, number, subject, organization_id, status, assignee_id, created_at, updated_at FROM platypus.tickets ORDER BY id LIMIT 100001) row_data
) snapshot_budget`;

export async function readSnapshot(client) {
  try {
    const budget = await client.query(budgetSql);
    const bytes = budget.rows?.[0]?.bytes;
    requireValue(
      typeof bytes === 'string' &&
        /^\d+$/.test(bytes) &&
        BigInt(bytes) <= BigInt(MAX_SNAPSHOT_BYTES),
      'Source data exceeds the migration byte limit.',
    );
    const organizations = await client.query(
      'SELECT id, display_name FROM platypus.organizations ORDER BY id LIMIT 10001',
    );
    const agents = await client.query(
      'SELECT id, display_name FROM platypus.support_agents ORDER BY id LIMIT 10001',
    );
    const tickets =
      await client.query(`SELECT id, number, subject, organization_id, status, assignee_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
      to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS updated_at
      FROM platypus.tickets ORDER BY id LIMIT 100001`);
    return await buildSnapshot({
      organizations: organizations.rows,
      support_agents: agents.rows,
      tickets: tickets.rows,
    });
  } catch (error) {
    if (error instanceof SnapshotError) throw error;
    throw new SnapshotError('Reading the migration data failed.');
  }
}
