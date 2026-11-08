import { InjectionToken } from '@angular/core';
import { parseTickets } from './ticket';
import {
  parseTicketOptions,
  ticketSearchParameters,
  type TicketOptions,
  type TicketPage,
  type TicketQuery,
} from './ticket-query';

export interface TicketConfiguration {
  baseUrl: string;
  mode: 'legacy' | 'paged';
}
export interface TicketData {
  configuration(signal: AbortSignal): Promise<TicketConfiguration>;
  load(
    configuration: TicketConfiguration,
    query: TicketQuery,
    signal: AbortSignal,
  ): Promise<TicketPage>;
  options(
    configuration: TicketConfiguration,
    signal: AbortSignal,
  ): Promise<TicketOptions>;
}
export const TICKET_DATA = new InjectionToken<TicketData>(
  'Support ticket data',
);

export class ApiTicketData implements TicketData {
  constructor(private readonly configUrl: URL) {}

  async configuration(signal: AbortSignal): Promise<TicketConfiguration> {
    const response = await fetch(this.configUrl, { signal, cache: 'no-store' });
    if (!response.ok)
      throw new Error('Ticket server configuration is unavailable.');
    const config: unknown = await response.json();
    if (
      typeof config !== 'object' ||
      config === null ||
      !('apiBaseUrl' in config) ||
      typeof config.apiBaseUrl !== 'string' ||
      ('ticketQueryMode' in config && config.ticketQueryMode !== 'paged')
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
    return {
      baseUrl: base.origin,
      mode: 'ticketQueryMode' in config ? 'paged' : 'legacy',
    };
  }

  async load(
    configuration: TicketConfiguration,
    query: TicketQuery,
    signal: AbortSignal,
  ): Promise<TicketPage> {
    const url = new URL(
      configuration.mode === 'paged' ? '/api/tickets/query' : '/api/tickets',
      configuration.baseUrl,
    );
    if (configuration.mode === 'paged')
      url.search = ticketSearchParameters(query).toString();
    const response = await fetch(url, { signal, cache: 'no-store' });
    if (!response.ok) throw new Error('Tickets could not be loaded.');
    const value: unknown = await response.json();
    if (
      typeof value !== 'object' ||
      value === null ||
      !('items' in value) ||
      !('total' in value)
    )
      throw new Error('The ticket response is invalid.');
    if (
      configuration.mode === 'paged' &&
      (!Array.isArray(value.items) || value.items.length > query.pageSize)
    )
      throw new Error('The ticket page is invalid.');
    const items = parseTickets(value.items);
    if (
      !Number.isSafeInteger(value.total) ||
      (value.total as number) < items.length
    )
      throw new Error('The ticket count is invalid.');
    if (configuration.mode === 'legacy') {
      if (value.total !== items.length)
        throw new Error('The ticket count is invalid.');
      return { items, total: items.length, page: 1, pageSize: 25 };
    }
    if (
      !('page' in value) ||
      !('pageSize' in value) ||
      value.page !== query.page ||
      value.pageSize !== query.pageSize ||
      items.length > query.pageSize ||
      ((query.page - 1) * query.pageSize >= (value.total as number) &&
        items.length !== 0)
    )
      throw new Error('The ticket page is invalid.');
    return {
      items,
      total: value.total as number,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async options(
    configuration: TicketConfiguration,
    signal: AbortSignal,
  ): Promise<TicketOptions> {
    if (configuration.mode === 'legacy')
      return { organizations: [], assignees: [] };
    const response = await fetch(
      new URL('/api/tickets/options', configuration.baseUrl),
      { signal, cache: 'no-store' },
    );
    if (!response.ok) throw new Error('Ticket filters could not be loaded.');
    return parseTicketOptions(await response.json());
  }
}
