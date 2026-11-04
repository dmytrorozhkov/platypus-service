import { createApplication } from '@angular/platform-browser';
import { APP_ID, type ApplicationRef } from '@angular/core';
import { Support } from './app/support';
import { FixtureTicketData, TICKET_DATA } from './app/tickets/ticket-data';
export async function createSupportApplication(): Promise<ApplicationRef> {
  return createApplication({
    providers: [
      { provide: APP_ID, useValue: 'platypus-support' },
      {
        provide: TICKET_DATA,
        useFactory: () =>
          new FixtureTicketData(
            new URL('./fixtures/tickets.json', import.meta.url),
          ),
      },
    ],
  });
}
export function renderSupport(
  application: ApplicationRef,
  host: HTMLElement,
): void {
  application.bootstrap(Support, host);
}
