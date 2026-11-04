import fixtures from './fixtures/tickets.json' with { type: 'json' };

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
}
// Replace this repository with PostgreSQL access in a later stage.
export class FixtureTicketRepository implements TicketRepository {
  async list(): Promise<TicketCollection> {
    const items = structuredClone(fixtures) as Ticket[];
    return { items, total: items.length };
  }
}
