import { InjectionToken } from '@angular/core';
import { parseTickets, type Ticket } from './ticket';
export interface TicketData {
  load(signal: AbortSignal): Promise<Ticket[]>;
}
export const TICKET_DATA = new InjectionToken<TicketData>(
  'Support ticket data',
);
export class FixtureTicketData implements TicketData {
  constructor(private readonly url: URL) {}
  async load(signal: AbortSignal): Promise<Ticket[]> {
    const response = await fetch(this.url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Tickets could not be loaded.');
    return parseTickets(await response.json());
  }
}
