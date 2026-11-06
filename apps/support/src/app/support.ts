import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TicketStore } from './tickets/ticket-store';
import { ticketStatuses, type TicketStatus } from './tickets/ticket';
import type {
  TicketPageSize,
  TicketQuery,
  TicketSort,
} from './tickets/ticket-query';

@Component({
  selector: 'ps-support',
  imports: [DatePipe],
  providers: [TicketStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support.html',
})
export class Support {
  readonly store = inject(TicketStore);
  readonly statuses = ticketStatuses;
  readonly sorts: { value: TicketSort; label: string }[] = [
    { value: 'number', label: 'Number' },
    { value: 'subject', label: 'Subject' },
    { value: 'organization', label: 'Organization' },
    { value: 'status', label: 'Status' },
    { value: 'assignee', label: 'Assignee' },
    { value: 'createdAt', label: 'Created date' },
    { value: 'updatedAt', label: 'Updated date' },
  ];
  search(event: Event, value: string): void {
    event.preventDefault();
    this.store.setQuery({ search: value.trim() });
  }
  filter(
    name:
      | 'status'
      | 'organization'
      | 'assignee'
      | 'createdFrom'
      | 'createdTo'
      | 'sort'
      | 'direction'
      | 'pageSize',
    event: Event,
  ): void {
    const value = (event.target as HTMLSelectElement | HTMLInputElement).value;
    const patch: Partial<Omit<TicketQuery, 'page'>> =
      name === 'pageSize'
        ? { pageSize: Number(value) as TicketPageSize }
        : name === 'status'
          ? { status: value as TicketStatus | '' }
          : name === 'sort'
            ? { sort: value as TicketSort }
            : name === 'direction'
              ? { direction: value as 'asc' | 'desc' }
              : { [name]: value };
    this.store.setQuery(patch);
  }
  totalPages(): number {
    return Math.max(
      1,
      Math.ceil(this.store.total() / this.store.query().pageSize),
    );
  }
  reset(search: HTMLInputElement): void {
    search.value = '';
    this.store.reset();
  }
}
