import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  explicitConnectionFromEnvironment,
  loadSeedInput,
  validateSeedInput,
} from '../database/migrate-seed.mjs';

const fixture = JSON.parse(
  await readFile(
    new URL('../src/fixtures/tickets.json', import.meta.url),
    'utf8',
  ),
);
const identities = JSON.parse(
  await readFile(
    new URL('../database/seed-identities.json', import.meta.url),
    'utf8',
  ),
);

test('authoritative seed has stable identities, UTC instants and format-independent checksum', async () => {
  const value = await loadSeedInput();
  assert.equal(value.organizations.length, 5);
  assert.equal(value.supportAgents.length, 3);
  assert.equal(value.tickets.length, 25);
  assert.equal(value.tickets[0].number, 'PS-1001');
  assert.equal(value.tickets.at(-1).number, 'PS-1025');
  assert.equal(value.tickets[0].assigneeId, null);
  assert.match(value.checksum, /^[a-f0-9]{64}$/);
  assert.equal(
    value.checksum,
    validateSeedInput([...fixture].reverse(), {
      organizations: [...identities.organizations].reverse(),
      supportAgents: [...identities.supportAgents].reverse(),
      tickets: [...identities.tickets].reverse(),
    }).checksum,
  );
  const equivalent = structuredClone(fixture);
  equivalent[0].createdAt = '2026-10-05T11:00:00+02:00';
  assert.equal(
    value.checksum,
    validateSeedInput(equivalent, identities).checksum,
  );
  equivalent[0].subject += ' changed';
  assert.notEqual(
    value.checksum,
    validateSeedInput(equivalent, identities).checksum,
  );
});

test('seed validation rejects bad data and incomplete or ambiguous identity coverage', () => {
  const changes = [
    (tickets) => {
      tickets[0].status = 'Unknown';
    },
    (tickets) => {
      tickets[0].subject = ' \t ';
    },
    (tickets) => {
      tickets[0].number = tickets[1].number;
    },
    (tickets) => {
      tickets[0].createdAt = '2026-10-05T09:00:00';
    },
    (tickets) => {
      tickets[0].createdAt = 'infinity';
    },
    (tickets) => {
      tickets[0].createdAt = '2026-02-30T09:00:00Z';
    },
    (tickets) => {
      tickets[0].createdAt = '2026-10-05T24:00:00Z';
    },
    (tickets) => {
      tickets[0].updatedAt = '2020-01-01T00:00:00Z';
    },
    (tickets) => {
      tickets[0].organization = 'Different organization';
    },
    (tickets) => {
      tickets[0].assignee = undefined;
    },
    (_, map) => {
      map.tickets.pop();
    },
    (_, map) => {
      map.tickets[0].id = map.tickets[1].id;
    },
    (_, map) => {
      map.tickets[0].organizationKey = 'missing';
    },
    (_, map) => {
      map.organizations[0].id = 'invalid';
    },
    (_, map) => {
      map.supportAgents[0].seedKey = map.supportAgents[1].seedKey;
    },
  ];
  for (const change of changes) {
    const tickets = structuredClone(fixture);
    const map = structuredClone(identities);
    change(tickets, map);
    assert.throws(() => validateSeedInput(tickets, map));
  }
});

test('setup refuses implicit database defaults and malformed ports without exposing passwords', () => {
  const env = {
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: 'platypus_service_test',
    PGUSER: 'owner',
    PGPASSWORD: 'test-only-password',
  };
  assert.equal(explicitConnectionFromEnvironment(env).database, env.PGDATABASE);
  for (const key of Object.keys(env)) {
    const missing = { ...env };
    delete missing[key];
    assert.throws(
      () => explicitConnectionFromEnvironment(missing),
      new RegExp(key),
    );
  }
  for (const port of ['0', '65536', '-1', '5432x', '']) {
    assert.throws(() =>
      explicitConnectionFromEnvironment({ ...env, PGPORT: port }),
    );
  }
});
