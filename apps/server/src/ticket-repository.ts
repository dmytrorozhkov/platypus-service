import fixtures from './fixtures/tickets.json' with { type: 'json' };
import type { TicketQuery } from './ticket-query.js';
export type { TicketQuery } from './ticket-query.js';

export interface Ticket {
  number: string;
  subject: string;
  organization: string;
  status: 'New' | 'In progress' | 'Awaiting customer' | 'Closed';
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface TicketCollection {
  items: Ticket[];
  total: number;
}
export interface TicketRepository {
  list(): Promise<TicketCollection>;
  query?(query: TicketQuery): Promise<TicketPage>;
  options?(): Promise<TicketOptions>;
}
export interface TicketPage extends TicketCollection {
  page: number;
  pageSize: 25 | 50 | 100;
}
export interface TicketDirectoryOption {
  id: string;
  name: string;
}
export interface TicketOptions {
  organizations: TicketDirectoryOption[];
  assignees: TicketDirectoryOption[];
}
// Deliberate small fixture demo; paged capabilities are available only on supporting repositories.
export class FixtureTicketRepository implements TicketRepository {
  async list(): Promise<TicketCollection> {
    const items = structuredClone(fixtures) as Ticket[];
    return { items, total: items.length };
  }
}
