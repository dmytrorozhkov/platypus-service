import { ticketStatuses, type Ticket, type TicketStatus } from './ticket';

export const ticketSortFields = [
  'number',
  'subject',
  'organization',
  'status',
  'assignee',
  'createdAt',
  'updatedAt',
] as const;
export type TicketSort = (typeof ticketSortFields)[number];
export type TicketPageSize = 25 | 50 | 100;
export interface TicketQuery {
  page: number;
  pageSize: TicketPageSize;
  search: string;
  status: TicketStatus | '';
  organization: string;
  assignee: string;
  createdFrom: string;
  createdTo: string;
  sort: TicketSort;
  direction: 'asc' | 'desc';
}
export interface TicketOptions {
  organizations: { id: string; name: string }[];
  assignees: { id: string; name: string }[];
}
export interface TicketPage {
  items: Ticket[];
  total: number;
  page: number;
  pageSize: TicketPageSize;
}
export const defaultTicketQuery: Readonly<TicketQuery> = {
  page: 1,
  pageSize: 25,
  search: '',
  status: '',
  organization: '',
  assignee: '',
  createdFrom: '',
  createdTo: '',
  sort: 'createdAt',
  direction: 'desc',
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function calendarDate(value: string): boolean {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export function ticketQueryError(query: TicketQuery): string | null {
  if (
    !Number.isSafeInteger(query.page) ||
    query.page < 1 ||
    query.page > 100000 ||
    ![25, 50, 100].includes(query.pageSize)
  )
    return 'Choose a valid page and page size.';
  if (query.search.trim().length > 100)
    return 'Search must contain at most 100 characters.';
  if (
    [...query.search].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return 'Search must not contain control characters.';
  if (
    (query.status && !ticketStatuses.includes(query.status)) ||
    !ticketSortFields.includes(query.sort) ||
    !['asc', 'desc'].includes(query.direction)
  )
    return 'Choose valid ticket filters and sorting.';
  if (
    (query.organization && !uuid.test(query.organization)) ||
    (query.assignee &&
      query.assignee !== 'unassigned' &&
      !uuid.test(query.assignee))
  )
    return 'Choose a valid organization and assignee.';
  if (
    (query.createdFrom && !calendarDate(query.createdFrom)) ||
    (query.createdTo && !calendarDate(query.createdTo))
  )
    return 'Choose valid calendar dates.';
  if (
    query.createdFrom &&
    query.createdTo &&
    query.createdFrom > query.createdTo
  )
    return 'Created from must be on or before Created to.';
  return null;
}
export function ticketSearchParameters(query: TicketQuery): URLSearchParams {
  const error = ticketQueryError(query);
  if (error) throw new Error(error);
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    const text = typeof value === 'string' ? value.trim() : String(value);
    if (text) parameters.set(name, text);
  }
  return parameters;
}
export function parseTicketOptions(value: unknown): TicketOptions {
  if (typeof value !== 'object' || value === null)
    throw new Error('Ticket options are invalid.');
  const record = value as Record<string, unknown>;
  function directory(name: string): { id: string; name: string }[] {
    const values = record[name];
    if (!Array.isArray(values) || values.length > 1000)
      throw new Error('Ticket options exceed their supported limit.');
    const ids = new Set<string>();
    return values.map((item: unknown) => {
      if (typeof item !== 'object' || item === null)
        throw new Error('Ticket options are invalid.');
      const entry = item as Record<string, unknown>;
      if (
        typeof entry['id'] !== 'string' ||
        !uuid.test(entry['id']) ||
        ids.has(entry['id'].toLowerCase()) ||
        typeof entry['name'] !== 'string' ||
        !entry['name'].trim()
      )
        throw new Error('Ticket options are invalid.');
      ids.add(entry['id'].toLowerCase());
      return { id: entry['id'], name: entry['name'] };
    });
  }
  return {
    organizations: directory('organizations'),
    assignees: directory('assignees'),
  };
}
