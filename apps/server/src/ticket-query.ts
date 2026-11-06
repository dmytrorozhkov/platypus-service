import type { Ticket } from './ticket-repository.js';

export const ticketSortFields = [
  'number',
  'subject',
  'organization',
  'status',
  'assignee',
  'createdAt',
  'updatedAt',
] as const;
export interface TicketQuery {
  page: number;
  pageSize: 25 | 50 | 100;
  search: string;
  status?: Ticket['status'];
  organization?: string;
  assignee?: string;
  createdFrom?: string;
  createdTo?: string;
  sort: (typeof ticketSortFields)[number];
  direction: 'asc' | 'desc';
}

export class InvalidTicketQuery extends Error {
  constructor() {
    super('The ticket query is invalid.');
  }
}

export function isTicketDirectoryId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function calendarDate(value: string): boolean {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00.000Z');
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

export function parseTicketQuery(rawQuery = ''): TicketQuery {
  if (
    rawQuery.length > 2048 ||
    rawQuery.startsWith('?') ||
    rawQuery.includes('#') ||
    containsControlCharacter(rawQuery)
  )
    throw new InvalidTicketQuery();
  try {
    decodeURIComponent(rawQuery.replace(/\+/g, ' '));
  } catch {
    throw new InvalidTicketQuery();
  }
  const parameters = new URLSearchParams(rawQuery);
  const allowed = new Set([
    'page',
    'pageSize',
    'search',
    'status',
    'organization',
    'assignee',
    'createdFrom',
    'createdTo',
    'sort',
    'direction',
  ]);
  const seen = new Set<string>();
  for (const [name, value] of parameters) {
    if (!allowed.has(name) || seen.has(name) || containsControlCharacter(value))
      throw new InvalidTicketQuery();
    seen.add(name);
  }
  const pageText = parameters.get('page') ?? '1';
  if (!/^[1-9][0-9]*$/.test(pageText) || Number(pageText) > 100000)
    throw new InvalidTicketQuery();
  const sizeText = parameters.get('pageSize') ?? '25';
  if (!['25', '50', '100'].includes(sizeText)) throw new InvalidTicketQuery();
  const search = (parameters.get('search') ?? '').trim();
  if (search.length > 100) throw new InvalidTicketQuery();
  const status = parameters.get('status');
  if (
    status !== null &&
    !['New', 'In progress', 'Awaiting customer', 'Closed'].includes(status)
  )
    throw new InvalidTicketQuery();
  const organization = parameters.get('organization');
  if (organization !== null && !isTicketDirectoryId(organization))
    throw new InvalidTicketQuery();
  const assignee = parameters.get('assignee');
  if (
    assignee !== null &&
    assignee !== 'unassigned' &&
    !isTicketDirectoryId(assignee)
  )
    throw new InvalidTicketQuery();
  const createdFrom = parameters.get('createdFrom');
  const createdTo = parameters.get('createdTo');
  if (
    (createdFrom !== null && !calendarDate(createdFrom)) ||
    (createdTo !== null && !calendarDate(createdTo)) ||
    (createdFrom !== null && createdTo !== null && createdFrom > createdTo)
  )
    throw new InvalidTicketQuery();
  const sort = parameters.get('sort') ?? 'createdAt';
  if (!(ticketSortFields as readonly string[]).includes(sort))
    throw new InvalidTicketQuery();
  const direction = parameters.get('direction') ?? 'desc';
  if (direction !== 'asc' && direction !== 'desc')
    throw new InvalidTicketQuery();
  return {
    page: Number(pageText),
    pageSize: Number(sizeText) as TicketQuery['pageSize'],
    search,
    ...(status === null ? {} : { status: status as Ticket['status'] }),
    ...(organization === null
      ? {}
      : { organization: organization.toLowerCase() }),
    ...(assignee === null ? {} : { assignee: assignee.toLowerCase() }),
    ...(createdFrom === null ? {} : { createdFrom }),
    ...(createdTo === null ? {} : { createdTo }),
    sort: sort as TicketQuery['sort'],
    direction,
  };
}
