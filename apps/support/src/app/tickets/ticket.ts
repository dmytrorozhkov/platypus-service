export const ticketStatuses = [
  'New',
  'In progress',
  'Awaiting customer',
  'Closed',
] as const;
export type TicketStatus = (typeof ticketStatuses)[number];
export interface Ticket {
  number: string;
  subject: string;
  organization: string;
  status: TicketStatus;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}
export function parseTickets(value: unknown): Ticket[] {
  if (!Array.isArray(value))
    throw new Error('The ticket response must be a list.');
  const numbers = new Set<string>();
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null)
      throw new Error('The ticket response is invalid.');
    const record = item as Record<string, unknown>;
    for (const field of [
      'number',
      'subject',
      'organization',
      'createdAt',
      'updatedAt',
    ]) {
      if (typeof record[field] !== 'string' || !record[field].trim())
        throw new Error('The ticket response is incomplete.');
    }
    if (
      !ticketStatuses.includes(record['status'] as TicketStatus) ||
      (record['assignee'] !== null &&
        (typeof record['assignee'] !== 'string' ||
          !record['assignee'].trim())) ||
      !Number.isFinite(Date.parse(record['createdAt'] as string)) ||
      !Number.isFinite(Date.parse(record['updatedAt'] as string)) ||
      numbers.has(record['number'] as string)
    )
      throw new Error('The ticket response is invalid.');
    numbers.add(record['number'] as string);
    return {
      number: record['number'] as string,
      subject: record['subject'] as string,
      organization: record['organization'] as string,
      status: record['status'] as TicketStatus,
      assignee: record['assignee'] as string | null,
      createdAt: record['createdAt'] as string,
      updatedAt: record['updatedAt'] as string,
    };
  });
}
