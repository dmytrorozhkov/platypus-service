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
import {
  defaultTicketQuery,
  ticketQueryError,
  type TicketOptions,
  type TicketQuery,
} from './ticket-query';

interface TicketState {
  items: Ticket[];
  total: number;
  mode: 'unknown' | 'legacy' | 'paged';
  query: TicketQuery;
  options: TicketOptions;
  status: 'loading' | 'ready' | 'error';
  error: string | null;
}
export const TicketStore = signalStore(
  withState<TicketState>({
    items: [],
    total: 0,
    mode: 'unknown',
    query: { ...defaultTicketQuery },
    options: { organizations: [], assignees: [] },
    status: 'loading',
    error: null,
  }),
  withMethods((store, data = inject(TICKET_DATA)) => {
    let active: AbortController | undefined;
    async function load(): Promise<void> {
      active?.abort();
      const request = new AbortController();
      active = request;
      const query = { ...store.query() };
      patchState(store, { items: [], status: 'loading', error: null });
      const invalid = ticketQueryError(query);
      if (invalid) {
        patchState(store, { status: 'error', error: invalid });
        return;
      }
      try {
        const configuration = await data.configuration(request.signal);
        if (request.signal.aborted || active !== request) return;
        // Expose filters even when the following page/options request fails.
        patchState(store, { mode: configuration.mode });
        const [page, options] = await Promise.all([
          data.load(configuration, query, request.signal),
          data.options(configuration, request.signal),
        ]);
        if (!request.signal.aborted && active === request)
          patchState(store, {
            items: page.items,
            total: page.total,
            options,
            status: 'ready',
          });
      } catch {
        if (!request.signal.aborted && active === request) {
          patchState(store, {
            status: 'error',
            error: 'We could not load tickets. Please try again.',
          });
          request.abort();
        }
      }
    }
    return {
      load,
      setQuery(patch: Partial<Omit<TicketQuery, 'page'>>): void {
        patchState(store, { query: { ...store.query(), ...patch, page: 1 } });
        void load();
      },
      goToPage(page: number): void {
        if (
          !Number.isSafeInteger(page) ||
          page < 1 ||
          page > 100000 ||
          page === store.query().page
        )
          return;
        patchState(store, { query: { ...store.query(), page } });
        void load();
      },
      reset(): void {
        patchState(store, { query: { ...defaultTicketQuery } });
        void load();
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
