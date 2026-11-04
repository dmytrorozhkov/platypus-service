import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';
import { TICKET_DATA } from './ticket-data';
import type { Ticket } from './ticket';
interface TicketState {
  items: Ticket[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}
export const TicketStore = signalStore(
  withState<TicketState>({ items: [], status: 'loading', error: null }),
  withMethods((store, data = inject(TICKET_DATA)) => {
    let active: AbortController | undefined;
    return {
      async load(): Promise<void> {
        active?.abort();
        const request = new AbortController();
        active = request;
        patchState(store, { items: [], status: 'loading', error: null });
        try {
          const items = await data.load(request.signal);
          if (!request.signal.aborted && active === request)
            patchState(store, { items, status: 'ready' });
        } catch {
          if (!request.signal.aborted && active === request)
            patchState(store, {
              status: 'error',
              error: 'We could not load tickets. Please try again.',
            });
        }
      },
      cancel(): void {
        active?.abort();
        active = undefined;
      },
    };
  }),
  withHooks({
    onInit(store) {
      void store.load();
    },
    onDestroy(store) {
      store.cancel();
    },
  }),
);
