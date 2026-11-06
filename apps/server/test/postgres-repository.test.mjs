import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  PostgresTicketRepository,
  ticketListSql,
} from '../dist/postgres-ticket-repository.js';

const fixture = JSON.parse(
  await readFile(
    new URL('../src/fixtures/tickets.json', import.meta.url),
    'utf8',
  ),
);
function row(ticket = fixture[0]) {
  return {
    number: ticket.number,
    subject: ticket.subject,
    organization: ticket.organization,
    status: ticket.status,
    assignee: ticket.assignee,
    created_at: new Date(ticket.createdAt),
    updated_at: new Date(ticket.updatedAt),
    internal_id: 'never expose database metadata',
  };
}

test('PostgreSQL adapter maps all authoritative examples to the unchanged public contract', async () => {
  const statements = [];
  const repository = new PostgresTicketRepository({
    query: async (sql) => {
      statements.push(sql);
      return { rows: fixture.map(row) };
    },
  });
  const actual = await repository.list();
  assert.deepEqual(actual, {
    items: fixture.map((ticket) => ({
      ...ticket,
      createdAt: new Date(ticket.createdAt).toISOString(),
      updatedAt: new Date(ticket.updatedAt).toISOString(),
    })),
    total: 25,
  });
  assert.deepEqual(statements, [ticketListSql]);
  assert.match(ticketListSql, /FROM platypus\.tickets AS t/);
  assert.match(
    ticketListSql,
    /JOIN platypus\.organizations AS o ON o\.id = t\.organization_id/,
  );
  assert.match(
    ticketListSql,
    /LEFT JOIN platypus\.support_agents AS a ON a\.id = t\.assignee_id/,
  );
  assert.match(ticketListSql, /ORDER BY t\.created_at ASC, t\.number ASC$/);
  assert(!ticketListSql.includes('SELECT *'));
  assert(actual.items.some((item) => item.assignee === null));
});

test('empty PostgreSQL results stay empty and explicit-offset instants normalize to UTC', async () => {
  const empty = new PostgresTicketRepository({
    query: async () => ({ rows: [] }),
  });
  assert.deepEqual(await empty.list(), { items: [], total: 0 });
  const example = {
    ...row(),
    created_at: '2026-11-01T10:00:00+02:00',
    updated_at: '2026-11-01T09:00:00Z',
  };
  const repository = new PostgresTicketRepository({
    query: async () => ({ rows: [example] }),
  });
  const { items, total } = await repository.list();
  assert.equal(total, 1);
  assert.equal(items[0].createdAt, '2026-11-01T08:00:00.000Z');
  assert.equal(items[0].updatedAt, '2026-11-01T09:00:00.000Z');
});

test('invalid PostgreSQL rows reject the collection instead of corrupting the public response', async () => {
  for (const change of [
    { number: 'other' },
    { subject: '' },
    { organization: null },
    { status: 'Done' },
    { assignee: undefined },
    { assignee: '' },
    { created_at: new Date(NaN) },
    { created_at: '2026-11-01 08:00:00' },
    { updated_at: Infinity },
    { created_at: '2026-11-02T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' },
  ]) {
    const repository = new PostgresTicketRepository({
      query: async () => ({ rows: [row(), { ...row(), ...change }] }),
    });
    await assert.rejects(repository.list(), /PostgreSQL returned/);
  }
});

test('database query rejection propagates for the existing sanitized application error boundary', async () => {
  const failure = Object.assign(
    new Error('private credentials must not be returned by HTTP'),
    { code: '08006' },
  );
  const repository = new PostgresTicketRepository({
    query: async () => {
      throw failure;
    },
  });
  await assert.rejects(repository.list(), (observed) => observed === failure);
});
