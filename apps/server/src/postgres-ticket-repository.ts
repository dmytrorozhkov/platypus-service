import type {
  Ticket,
  TicketCollection,
  TicketRepository,
  TicketQuery,
  TicketPage,
  TicketOptions,
  TicketDirectoryOption,
} from './ticket-repository.js';
import { isTicketDirectoryId } from './ticket-query.js';

export interface TicketQueryable {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }>;
}

export const ticketListSql = `
SELECT t.number, t.subject, o.display_name AS organization,
       t.status, a.display_name AS assignee, t.created_at, t.updated_at
FROM platypus.tickets AS t
JOIN platypus.organizations AS o ON o.id = t.organization_id
LEFT JOIN platypus.support_agents AS a ON a.id = t.assignee_id
ORDER BY t.created_at ASC, t.number ASC
LIMIT 101`;

function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new Error('PostgreSQL returned an invalid ticket field.');
  return value;
}

function instant(value: unknown): string {
  if (
    !(value instanceof Date) &&
    !(typeof value === 'string' && /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value))
  )
    throw new Error('PostgreSQL returned an invalid ticket timestamp.');
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error('PostgreSQL returned an invalid ticket timestamp.');
  return date.toISOString();
}

function ticket(row: Record<string, unknown>): Ticket {
  const number = text(row['number']);
  if (!/^PS-[1-9][0-9]*$/.test(number))
    throw new Error('PostgreSQL returned an invalid ticket number.');
  const status = row['status'];
  if (
    status !== 'New' &&
    status !== 'In progress' &&
    status !== 'Awaiting customer' &&
    status !== 'Closed'
  )
    throw new Error('PostgreSQL returned an invalid ticket status.');
  const createdAt = instant(row['created_at']);
  const updatedAt = instant(row['updated_at']);
  if (Date.parse(updatedAt) < Date.parse(createdAt))
    throw new Error('PostgreSQL returned invalid ticket timestamps.');
  return {
    number,
    subject: text(row['subject']),
    organization: text(row['organization']),
    status,
    assignee: row['assignee'] === null ? null : text(row['assignee']),
    createdAt,
    updatedAt,
  };
}

export class PostgresTicketRepository implements TicketRepository {
  constructor(private readonly database: TicketQueryable) {}

  async list(): Promise<TicketCollection> {
    const { rows } = await this.database.query(ticketListSql);
    if (rows.length > 100)
      throw new Error(
        'The legacy ticket collection is too large. Use paged queries.',
      );
    const items = rows.map(ticket);
    return { items, total: items.length };
  }

  async query(query: TicketQuery): Promise<TicketPage> {
    const statement = buildTicketPageQuery(query);
    const result = await this.database.query(statement.text, statement.values);
    const row = result.rows[0];
    if (
      result.rows.length !== 1 ||
      row === undefined ||
      !Array.isArray(row['items'])
    )
      throw new Error('PostgreSQL returned an invalid ticket page.');
    const totalText = row['total'];
    if (
      (typeof totalText !== 'string' && typeof totalText !== 'number') ||
      !/^\d+$/.test(String(totalText))
    )
      throw new Error('PostgreSQL returned an invalid ticket total.');
    const total = Number(totalText);
    const rawItems = row['items'];
    if (
      !Number.isSafeInteger(total) ||
      rawItems.length > query.pageSize ||
      rawItems.length > total
    )
      throw new Error('PostgreSQL returned an invalid ticket page.');
    const items = rawItems.map((value: unknown) => {
      if (typeof value !== 'object' || value === null || Array.isArray(value))
        throw new Error('PostgreSQL returned an invalid ticket page.');
      return ticket(value as Record<string, unknown>);
    });
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async options(): Promise<TicketOptions> {
    const result = await this.database.query(ticketOptionsSql);
    const row = result.rows[0];
    if (result.rows.length !== 1 || row === undefined)
      throw new Error('PostgreSQL returned invalid ticket options.');
    return {
      organizations: directory(row['organizations']),
      assignees: directory(row['assignees']),
    };
  }
}

function directory(value: unknown): TicketDirectoryOption[] {
  if (!Array.isArray(value) || value.length > 1000)
    throw new Error(
      'PostgreSQL ticket options exceed the supported directory limit.',
    );
  const seen = new Set<string>();
  return value.map((entry: unknown) => {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('id' in entry) ||
      !('name' in entry) ||
      typeof entry.id !== 'string' ||
      !isTicketDirectoryId(entry.id) ||
      seen.has(entry.id)
    )
      throw new Error('PostgreSQL returned invalid ticket options.');
    seen.add(entry.id);
    return { id: entry.id, name: text(entry.name) };
  });
}

export const ticketOptionsSql = `
SELECT
  COALESCE((SELECT jsonb_agg(d ORDER BY d.name COLLATE "C", d.id)
    FROM (SELECT id::text AS id, display_name AS name FROM platypus.organizations
          ORDER BY display_name COLLATE "C", id LIMIT 1001) AS d), '[]'::jsonb) AS organizations,
  COALESCE((SELECT jsonb_agg(d ORDER BY d.name COLLATE "C", d.id)
    FROM (SELECT id::text AS id, display_name AS name FROM platypus.support_agents
          ORDER BY display_name COLLATE "C", id LIMIT 1001) AS d), '[]'::jsonb) AS assignees`;

const sortColumns = {
  subject: 'subject',
  organization: 'organization',
  status: 'status',
  assignee: 'assignee',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;

function ticketOrder(query: TicketQuery, prefix = ''): string {
  if (query.direction !== 'asc' && query.direction !== 'desc')
    throw new Error('Invalid ticket ordering.');
  const direction = query.direction === 'asc' ? 'ASC' : 'DESC';
  const number = prefix + 'number';
  if (query.sort === 'number') {
    // Positive decimal suffixes compare by digit count and C-collated digits, without integer overflow.
    return `length(substring(${number} FROM 4)) ${direction} NULLS LAST, substring(${number} FROM 4) COLLATE "C" ${direction} NULLS LAST, ${number} COLLATE "C" ASC`;
  }
  const column = Object.hasOwn(sortColumns, query.sort)
    ? sortColumns[query.sort]
    : undefined;
  if (column === undefined) throw new Error('Invalid ticket ordering.');
  const isTimestamp = query.sort === 'createdAt' || query.sort === 'updatedAt';
  return `${prefix}${column}${isTimestamp ? '' : ' COLLATE "C"'} ${direction} NULLS LAST, ${number} COLLATE "C" ASC`;
}

export function buildTicketPageQuery(query: TicketQuery): {
  text: string;
  values: unknown[];
} {
  if (
    !Number.isInteger(query.page) ||
    query.page < 1 ||
    query.page > 100000 ||
    ![25, 50, 100].includes(query.pageSize)
  )
    throw new Error('Invalid ticket page.');
  const values: unknown[] = [];
  const parameter = (value: unknown) => {
    values.push(value);
    return '$' + values.length;
  };
  const where: string[] = [];
  if (query.search) {
    const pattern = parameter(
      '%' + query.search.replace(/[\\%_]/g, '\\$&') + '%',
    );
    where.push(
      `(t.number ILIKE ${pattern} ESCAPE E'\\\\' OR t.subject ILIKE ${pattern} ESCAPE E'\\\\')`,
    );
  }
  if (query.status !== undefined)
    where.push(`t.status = ${parameter(query.status)}`);
  if (query.organization !== undefined)
    where.push(`t.organization_id = ${parameter(query.organization)}::uuid`);
  if (query.assignee === 'unassigned') where.push('t.assignee_id IS NULL');
  else if (query.assignee !== undefined)
    where.push(`t.assignee_id = ${parameter(query.assignee)}::uuid`);
  if (query.createdFrom !== undefined)
    where.push(
      `t.created_at >= (${parameter(query.createdFrom)}::date::timestamp AT TIME ZONE 'UTC')`,
    );
  if (query.createdTo !== undefined)
    where.push(
      `t.created_at < ((${parameter(query.createdTo)}::date + 1)::timestamp AT TIME ZONE 'UTC')`,
    );
  const limit = parameter(query.pageSize);
  const offset = parameter((query.page - 1) * query.pageSize);
  return {
    text: `
WITH filtered AS MATERIALIZED (
  SELECT t.number, t.subject, o.display_name AS organization, t.status,
         a.display_name AS assignee, t.created_at, t.updated_at
  FROM platypus.tickets AS t
  JOIN platypus.organizations AS o ON o.id = t.organization_id
  LEFT JOIN platypus.support_agents AS a ON a.id = t.assignee_id
  ${where.length === 0 ? '' : 'WHERE ' + where.join(' AND ')}
), page AS (
  SELECT number, subject, organization, status, assignee, created_at, updated_at
  FROM filtered ORDER BY ${ticketOrder(query)} LIMIT ${limit} OFFSET ${offset}
)
SELECT (SELECT count(*)::text FROM filtered) AS total,
       COALESCE((SELECT jsonb_agg(p ORDER BY ${ticketOrder(query, 'p.')}) FROM page AS p), '[]'::jsonb) AS items`,
    values,
  };
}
