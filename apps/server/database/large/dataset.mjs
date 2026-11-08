import { createHash } from 'node:crypto';

export const LARGE_COUNTS = Object.freeze({
  organizations: 100,
  supportAgents: 40,
  tickets: 100000,
});
export const LARGE_SEED_KEY = 'tickets-large-v1';
const statuses = ['New', 'In progress', 'Awaiting customer', 'Closed'];
const topics = [
  'Account invitation',
  'Invoice download',
  'Search results',
  'Report export',
  'Notification delivery',
  'Profile update',
  'Access recovery',
  'File attachment',
  'Dashboard chart',
  'Subscription question',
  'Integration setup',
  'Table filtering',
];
const identity = (prefix, ordinal) =>
  `${prefix}-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`;

export function generateLargeDataset() {
  const organizations = Array.from(
    { length: LARGE_COUNTS.organizations },
    (_, index) => ({
      id: identity('41000000', index + 1),
      displayName: `Fictional Organization ${String(index + 1).padStart(3, '0')}`,
    }),
  );
  const supportAgents = Array.from(
    { length: LARGE_COUNTS.supportAgents },
    (_, index) => ({
      id: identity('42000000', index + 1),
      displayName: `Support Specialist ${String(index + 1).padStart(2, '0')}`,
    }),
  );
  const start = Date.UTC(2024, 0, 1);
  const tickets = Array.from({ length: LARGE_COUNTS.tickets }, (_, index) => {
    const created =
      start +
      (index % 900) * 86400000 +
      (Math.floor(index / 900) % 24) * 3600000;
    return {
      id: identity('43000000', index + 1),
      number: `PS-${index + 1}`,
      subject:
        index % 1000 === 0
          ? 'Literal 100% _ underscore \\ path'
          : `${topics[index % topics.length]} issue ${(index % 97) + 1}`,
      organizationId:
        organizations[
          (index * 37 + Math.floor(index / 100)) % organizations.length
        ].id,
      status: statuses[index % statuses.length],
      assigneeId:
        index % 7 === 0
          ? null
          : supportAgents[
              (index * 13 + Math.floor(index / 40)) % supportAgents.length
            ].id,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(
        created + ((index * 7) % 31) * 86400000 + (index % 60) * 60000,
      ).toISOString(),
    };
  });
  return { organizations, supportAgents, tickets };
}

export function datasetChecksums(dataset) {
  const directoryHash = (entries) => {
    const hash = createHash('sha256');
    for (const entry of entries)
      hash.update(`${entry.id}\x1f${entry.displayName}\n`);
    return hash.digest('hex');
  };
  const hash = createHash('sha256');
  for (const ticket of dataset.tickets) {
    hash.update(
      [
        ticket.id,
        ticket.number,
        ticket.subject,
        ticket.organizationId,
        ticket.status,
        ticket.assigneeId ?? '',
        ticket.createdAt,
        ticket.updatedAt,
      ].join('\x1f') + '\n',
    );
  }
  const checksums = {
    organizations: directoryHash(dataset.organizations),
    supportAgents: directoryHash(dataset.supportAgents),
    tickets: hash.digest('hex'),
  };
  return {
    ...checksums,
    seed: createHash('sha256')
      .update(
        JSON.stringify({
          seedKey: LARGE_SEED_KEY,
          counts: LARGE_COUNTS,
          checksums,
        }),
      )
      .digest('hex'),
  };
}
