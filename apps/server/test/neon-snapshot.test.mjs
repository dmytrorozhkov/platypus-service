import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  MAX_SNAPSHOT_BYTES,
  SnapshotError,
  loadSchema,
  buildSnapshot,
  validateSnapshot,
  encodeSnapshot,
  decodeSnapshot,
  snapshotSha256,
  dataFingerprint,
  readSnapshot,
} from '../database/neon/snapshot.mjs';

const identity = (number) =>
  `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`;
const clone = (value) => JSON.parse(JSON.stringify(value));
function data() {
  return {
    organizations: [
      { id: identity(1), display_name: 'Actual organization | "北"\n🌍' },
    ],
    support_agents: [
      { id: identity(2), display_name: 'Actual agent: Å | \nName' },
    ],
    tickets: [
      {
        id: identity(3),
        number: 'PS-150001',
        subject: 'Edited locally: line1\nline2 | "🌍" \\',
        organization_id: identity(1),
        status: 'In progress',
        assignee_id: identity(2),
        created_at: '2024-02-29T00:00:00.000Z',
        updated_at: '2026-11-06T21:00:00.123Z',
      },
    ],
  };
}
const rejects = (value) =>
  assert.rejects(() => validateSnapshot(value), SnapshotError);

test('schema digests bind exact current files and actual edited text survives canonical roundtrip', async () => {
  const schema = await loadSchema();
  assert.equal(
    schema.schemaSql,
    (
      await readFile(new URL('../database/001.sql', import.meta.url), 'utf8')
    ).replaceAll('\r\n', '\n'),
  );
  assert.equal(
    schema.indexSql,
    (
      await readFile(
        new URL('../database/large/indexes.sql', import.meta.url),
        'utf8',
      )
    ).replaceAll('\r\n', '\n'),
  );
  assert.equal(
    schema.schemaSha256,
    createHash('sha256').update(schema.schemaSql).digest('hex'),
  );
  assert.equal(
    schema.indexSha256,
    createHash('sha256').update(schema.indexSql).digest('hex'),
  );
  const snapshot = await buildSnapshot(data());
  const buffer = await encodeSnapshot(snapshot);
  assert.deepEqual(
    (await decodeSnapshot(buffer, snapshotSha256(buffer))).data,
    data(),
  );
  assert.equal(buffer.toString(), JSON.stringify(snapshot));
  assert.ok(Object.isFrozen(snapshot.data.tickets[0]));
});

test('build sorts UUID rows and field insertion order without mutating input; validation rejects unsorted rows', async () => {
  const input = data();
  input.organizations.unshift({ display_name: 'Later', id: identity(10) });
  const original = clone(input);
  const snapshot = await buildSnapshot(input);
  assert.deepEqual(input, original);
  assert.equal(snapshot.data.organizations[0].id, identity(1));
  const reordered = clone(snapshot);
  reordered.data.organizations.reverse();
  await rejects(reordered);
  const first = await buildSnapshot({
    tickets: input.tickets,
    support_agents: input.support_agents,
    organizations: input.organizations,
  });
  assert.equal(
    snapshotSha256(await encodeSnapshot(snapshot)),
    snapshotSha256(await encodeSnapshot(first)),
  );
});

test('fingerprint hashes typed canonical JSON, distinguishes delimiter layouts, and ignores envelope', async () => {
  const first = await buildSnapshot(data());
  const changed = clone(first);
  changed.data.organizations[0].display_name += '|';
  changed.data.tickets[0].subject = changed.data.tickets[0].subject.slice(1);
  assert.notEqual(dataFingerprint(first), dataFingerprint(changed));
  assert.equal(
    dataFingerprint(first),
    createHash('sha256').update(JSON.stringify(first.data)).digest('hex'),
  );
  changed.data = clone(first.data);
  changed.schemaSha256 = 'a'.repeat(64);
  assert.equal(dataFingerprint(first), dataFingerprint(changed));
  await rejects(changed);
});

test('reject unknown, duplicate/missing fields, unsafe object shapes and getters before reading values', async () => {
  const base = await buildSnapshot(data());
  const cases = [];
  for (const mutate of [
    (v) => {
      v.password = 'forbidden';
    },
    (v) => {
      delete v.data;
    },
    (v) => {
      v.data.unknown = [];
    },
    (v) => {
      v.data.organizations[0].seedKey = 'not-data';
    },
    (v) => {
      delete v.data.tickets[0].assignee_id;
    },
    (v) => {
      v.data.tickets[0].extra = 1;
    },
    (v) => {
      v.data.tickets[0] = Object.create(v.data.tickets[0]);
    },
    (v) => {
      v.data.tickets[0][Symbol('hidden')] = true;
    },
    (v) => {
      Object.defineProperty(v.data.tickets[0], 'subject', {
        get: () => {
          throw new Error('getter must not run');
        },
        enumerable: true,
      });
    },
    (v) => {
      v.data.tickets.length = 2;
    },
    (v) => {
      v.data.tickets.extra = 'forbidden';
    },
  ]) {
    const value = clone(base);
    mutate(value);
    cases.push(value);
  }
  for (const value of cases) await rejects(value);
  const canonical = await encodeSnapshot(base);
  const duplicate = Buffer.from(
    canonical
      .toString()
      .replace('"format":', '"format":"platypus-neon-data-v1","format":'),
  );
  await assert.rejects(
    () => decodeSnapshot(duplicate, snapshotSha256(duplicate)),
    /canonical encoding/,
  );
});

test('refuses duplicate UUIDs/numbers and invalid or dangling identities', async () => {
  const base = await buildSnapshot(data());
  for (const mutate of [
    (v) => {
      v.data.organizations.push(clone(v.data.organizations[0]));
    },
    (v) => {
      v.data.support_agents.push(clone(v.data.support_agents[0]));
    },
    (v) => {
      v.data.tickets.push(clone(v.data.tickets[0]));
    },
    (v) => {
      v.data.tickets.push({ ...v.data.tickets[0], id: identity(4) });
    },
    (v) => {
      v.data.tickets[0].organization_id = identity(9);
    },
    (v) => {
      v.data.tickets[0].assignee_id = identity(9);
    },
    (v) => {
      v.data.organizations[0].id = 'not-a-uuid';
    },
    (v) => {
      v.data.organizations[0].id = 'AAAAAAAA-0000-0000-0000-000000000001';
    },
    (v) => {
      v.data.tickets[0].id = 3;
    },
  ]) {
    const value = clone(base);
    mutate(value);
    await rejects(value);
  }
  const valid = clone(base);
  valid.data.tickets[0].assignee_id = null;
  assert.equal(
    (await validateSnapshot(valid)).data.tickets[0].assignee_id,
    null,
  );
});

test('strict timestamps reject normalization, offset, invalid calendar/clock, infinity and reversed updates', async () => {
  const base = await buildSnapshot(data());
  for (const timestamp of [
    '2025-02-29T00:00:00.000Z',
    '2024-02-30T00:00:00.000Z',
    '2024-02-29T24:00:00.000Z',
    '2024-02-29T00:00:60.000Z',
    '2024-02-29T00:00:00Z',
    '2024-02-29T00:00:00.000+00:00',
    '0000-01-01T00:00:00.000Z',
    'infinity',
    null,
    new Date(),
  ]) {
    const value = clone(base);
    value.data.tickets[0].created_at = timestamp;
    await rejects(value);
  }
  const reversed = clone(base);
  reversed.data.tickets[0].updated_at = '2024-01-01T00:00:00.000Z';
  await rejects(reversed);
});

test('text must be nonblank, PostgreSQL-compatible Unicode, and business fields retain schema constraints', async () => {
  const base = await buildSnapshot(data());
  for (const badText of [
    '',
    ' \t\r\n',
    '\ud800',
    '\udc00',
    'name\u0000tail',
    null,
    123,
  ]) {
    for (const field of ['subject', 'display_name']) {
      const value = clone(base);
      (field === 'subject'
        ? value.data.tickets[0]
        : value.data.organizations[0])[field] = badText;
      await rejects(value);
    }
  }
  for (const number of ['PS-0', 'PS-001', 'PS--1', 'PS-1\n', 'X-1', 'PS-1.1']) {
    const value = clone(base);
    value.data.tickets[0].number = number;
    await rejects(value);
  }
  for (const status of ['new', '', 'Closed ', null]) {
    const value = clone(base);
    value.data.tickets[0].status = status;
    await rejects(value);
  }
});

test('bounded counts reject oversized directories and tickets while an empty valid dataset is representable', async () => {
  assert.equal(
    (
      await buildSnapshot({
        organizations: [],
        support_agents: [],
        tickets: [],
      })
    ).data.tickets.length,
    0,
  );
  for (const [key, size] of [
    ['organizations', 10001],
    ['support_agents', 10001],
    ['tickets', 100001],
  ]) {
    const value = data();
    value[key] = Array(size).fill(value[key][0]);
    await assert.rejects(() => buildSnapshot(value), SnapshotError);
  }
});

test('actual 100000 distinct tickets are preserved without canonical generator/seed assumptions', async () => {
  const input = data();
  input.tickets = Array.from({ length: 100000 }, (_, index) => ({
    ...input.tickets[0],
    id: identity(index + 3),
    number: `PS-${index + 200000}`,
    subject:
      index === 12345
        ? 'A legitimate local edit 🌍\n| persists'
        : `Actual row ${index}`,
  }));
  const snapshot = await buildSnapshot(input);
  assert.equal(snapshot.data.tickets.length, 100000);
  assert.equal(
    snapshot.data.tickets[12345].subject,
    input.tickets[12345].subject,
  );
  const buffer = await encodeSnapshot(snapshot);
  assert.ok(buffer.length < MAX_SNAPSHOT_BYTES);
  assert.equal(
    dataFingerprint(await decodeSnapshot(buffer, snapshotSha256(buffer))),
    dataFingerprint(snapshot),
  );
});

test('external SHA is mandatory and mismatched versions, alternate JSON encodings and malformed UTF8 are refused', async () => {
  const snapshot = await buildSnapshot(data());
  const valid = await encodeSnapshot(snapshot);
  for (const sha of [undefined, '', '0'.repeat(64), 'A'.repeat(64)])
    await assert.rejects(() => decodeSnapshot(valid, sha), SnapshotError);
  for (const buffer of [
    Buffer.from(`${valid}\n`),
    Buffer.from(` ${valid}`),
    Buffer.from(JSON.stringify(snapshot, null, 2)),
    Buffer.from(valid.toString().replace('Actual row', 'Edited row')).subarray(
      0,
      -1,
    ),
    Buffer.from([0xc0, 0xaf]),
    Buffer.from([0xef, 0xbb, 0xbf, ...valid]),
  ]) {
    await assert.rejects(
      () => decodeSnapshot(buffer, snapshotSha256(buffer)),
      SnapshotError,
    );
  }
  for (const key of ['schemaSha256', 'indexSha256', 'format']) {
    const changed = clone(snapshot);
    changed[key] = key === 'format' ? 'unknown' : 'f'.repeat(64);
    await rejects(changed);
  }
});

test('oversized encoded input is refused before parsing and no raw JSON or database errors escape', async () => {
  const oversized = Buffer.alloc(MAX_SNAPSHOT_BYTES + 1);
  await assert.rejects(
    () => decodeSnapshot(oversized, '0'.repeat(64)),
    SnapshotError,
  );
  assert.throws(() => snapshotSha256(oversized), SnapshotError);
  const malformed = Buffer.from('{password: secret-value}');
  await assert.rejects(
    () => decodeSnapshot(malformed, snapshotSha256(malformed)),
    (error) =>
      error instanceof SnapshotError && !error.message.includes('secret-value'),
  );
  await assert.rejects(
    () =>
      readSnapshot({
        query: async () => {
          throw new Error('secret-password user-host');
        },
      }),
    (error) =>
      error instanceof SnapshotError &&
      !error.message.includes('secret-password') &&
      error.cause === undefined,
  );
});

test('escaping and structural byte budgets reject oversized text before expanding it as JSON', async () => {
  const input = data();
  const text = '\u0001'.repeat(Math.ceil(MAX_SNAPSHOT_BYTES / 6));
  input.tickets[0].subject = text;
  const stringify = JSON.stringify;
  let expanded = false;
  JSON.stringify = (value, ...args) => {
    if (value === text) expanded = true;
    return stringify(value, ...args);
  };
  try {
    await assert.rejects(() => buildSnapshot(input), /byte limit/);
    assert.equal(expanded, false);
  } finally {
    JSON.stringify = stringify;
  }
});

test('readSnapshot uses SELECT-only size preflight and stable bounded UTC SELECTs in caller transaction', async () => {
  const source = data();
  const queries = [];
  const client = {
    query: async (sql) => {
      queries.push(sql);
      if (sql.includes('snapshot_budget')) return { rows: [{ bytes: '1000' }] };
      if (sql.includes('FROM platypus.organizations'))
        return { rows: source.organizations };
      if (sql.includes('FROM platypus.support_agents'))
        return { rows: source.support_agents };
      return { rows: source.tickets };
    },
  };
  assert.deepEqual((await readSnapshot(client)).data, source);
  assert.equal(queries.length, 4);
  for (const sql of queries) assert.match(sql, /^SELECT\b/);
  assert.match(queries[0], /LIMIT 10001/);
  assert.match(queries[0], /LIMIT 100001/);
  assert.match(queries[1], /ORDER BY id LIMIT 10001$/);
  assert.match(queries[2], /ORDER BY id LIMIT 10001$/);
  assert.match(queries[3], /ORDER BY id LIMIT 100001$/);
  assert.equal(queries[3].match(/AT TIME ZONE 'UTC'/g).length, 2);
  assert.equal(
    queries.some((sql) =>
      /BEGIN|COMMIT|ROLLBACK|INSERT|UPDATE|DELETE/.test(sql),
    ),
    false,
  );
});

test('source byte preflight refuses oversize or malformed totals without fetching business data', async () => {
  for (const bytes of [
    String(MAX_SNAPSHOT_BYTES + 1),
    '-1',
    '1.0',
    10,
    undefined,
  ]) {
    let calls = 0;
    await assert.rejects(
      () =>
        readSnapshot({
          query: async () => {
            calls += 1;
            return { rows: [{ bytes }] };
          },
        }),
      SnapshotError,
    );
    assert.equal(calls, 1);
  }
});
