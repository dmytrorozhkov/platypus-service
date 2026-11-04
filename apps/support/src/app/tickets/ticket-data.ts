import { InjectionToken } from '@angular/core';
import { parseTickets, type Ticket } from './ticket';
export interface TicketData {
  load(signal: AbortSignal): Promise<Ticket[]>;
}
export const TICKET_DATA = new InjectionToken<TicketData>(
  'Support ticket data',
);

export class ApiTicketData implements TicketData {
  constructor(private readonly configUrl: URL) {}

  async load(signal: AbortSignal): Promise<Ticket[]> {
    const configuration = await fetch(this.configUrl, {
      signal,
      cache: 'no-store',
    });
    if (!configuration.ok)
      throw new Error('Ticket server configuration is unavailable.');
    const config: unknown = await configuration.json();
    if (
      typeof config !== 'object' ||
      config === null ||
      !('apiBaseUrl' in config) ||
      typeof config.apiBaseUrl !== 'string'
    )
      throw new Error('Ticket server configuration is invalid.');
    const base = new URL(config.apiBaseUrl);
    if (
      !['http:', 'https:'].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash ||
      base.pathname !== '/'
    )
      throw new Error('Ticket server address must be an HTTP origin.');
    const response = await fetch(new URL('/api/tickets', base), {
      signal,
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('Tickets could not be loaded.');
    const value: unknown = await response.json();
    if (
      typeof value !== 'object' ||
      value === null ||
      !('items' in value) ||
      !('total' in value)
    )
      throw new Error('The ticket response is invalid.');
    const items = parseTickets(value.items);
    if (!Number.isSafeInteger(value.total) || value.total !== items.length)
      throw new Error('The ticket count is invalid.');
    return items;
  }
}
