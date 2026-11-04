import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TicketStore } from './tickets/ticket-store';
@Component({
  selector: 'ps-support',
  imports: [DatePipe],
  providers: [TicketStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './support.html',
})
export class Support {
  readonly store = inject(TicketStore);
}
