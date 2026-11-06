import type {
  Ticket,
  TicketCollection,
  TicketRepository,
} from './ticket-repository.js';

export interface TicketQueryable {
  query(text: string): Promise<{ rows: Record<string, unknown>[] }>;
}

export const ticketListSql = `
SELECT t.number, t.subject, o.display_name AS organization,
       t.status, a.display_name AS assignee, t.created_at, t.updated_at
FROM platypus.tickets AS t
JOIN platypus.organizations AS o ON o.id = t.organization_id
LEFT JOIN platypus.support_agents AS a ON a.id = t.assignee_id
ORDER BY t.created_at ASC, t.number ASC`;

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
    const items = rows.map(ticket);
    return { items, total: items.length };
  }
}
