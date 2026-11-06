import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const require = createRequire(root + '/package.json');
const ts = require('typescript');
await import(pathToFileURL(require.resolve('@angular/compiler')));
const angular = await import(pathToFileURL(require.resolve('@angular/core')));
const ngrx = await import(pathToFileURL(require.resolve('@ngrx/signals')));
const loaded = new Map();
let requests = [];
let handler;
async function compile(name) {
  const source = await readFile(
    root + '/apps/support/src/app/tickets/' + name + '.ts',
    'utf8',
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(
    code,
    {
      module,
      exports: module.exports,
      require(specifier) {
        if (specifier === '@angular/core') return angular;
        if (specifier === '@ngrx/signals') return ngrx;
        const result = loaded.get(specifier.slice(2));
        assert(result, 'Unexpected module: ' + specifier);
        return result;
      },
      URL,
      URLSearchParams,
      AbortController,
      fetch: async (url, options) => {
        requests.push({ url: String(url), options });
        return handler(new URL(url), options);
      },
      console,
    },
    { filename: name + '.js' },
  );
  loaded.set(name, module.exports);
  return module.exports;
}
await compile('ticket');
const query = await compile('ticket-query');
const dataModule = await compile('ticket-data');
const storeModule = await compile('ticket-store');
const fixtures = JSON.parse(
  await readFile(root + '/apps/server/src/fixtures/tickets.json', 'utf8'),
);
const options = {
  organizations: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Example Org' },
  ],
  assignees: [],
};
const defaults = { ...query.defaultTicketQuery };
async function group(name, work) {
  await test(name, work);
}
await group(
  'literal search and full filters produce one bounded canonical query; invalid dates and limits reject',
  async () => {
    const selected = {
      ...defaults,
      search: '  %_\\  ',
      status: 'Closed',
      organization: options.organizations[0].id,
      assignee: 'unassigned',
      createdFrom: '2024-02-29',
      createdTo: '2024-03-01',
      sort: 'number',
      direction: 'asc',
      pageSize: 100,
      page: 2,
    };
    const encoded = query.ticketSearchParameters(selected);
    assert.equal(encoded.get('search'), '%_\\');
    assert.equal(encoded.get('page'), '2');
    assert.equal(encoded.get('organization'), options.organizations[0].id);
    for (const patch of [
      { createdFrom: '2025-02-29' },
      { createdFrom: '0000-01-01' },
      { createdFrom: '2025-04-01', createdTo: '2025-03-31' },
      { pageSize: 101 },
      { page: 0 },
      { search: 'x'.repeat(101) },
      { search: 'bad\0value' },
      { sort: 'unknown' },
    ])
      assert(query.ticketQueryError({ ...defaults, ...patch }));
  },
);
await group(
  'absent paged flag uses the exact legacy endpoint and count with no options request',
  async () => {
    requests = [];
    handler = (url) =>
      url.pathname === '/ticket-api-config.json'
        ? Response.json({ apiBaseUrl: 'http://localhost:3000' })
        : Response.json({ items: fixtures, total: 25 });
    const api = new dataModule.ApiTicketData(
      new URL('http://localhost:5175/ticket-api-config.json'),
    );
    const signal = new AbortController().signal;
    const config = await api.configuration(signal);
    const page = await api.load(config, defaults, signal);
    await api.options(config, signal);
    assert.equal(config.mode, 'legacy');
    assert.equal(page.items.length, 25);
    assert.equal(page.total, 25);
    assert.deepEqual(
      requests.map((item) => new URL(item.url).pathname),
      ['/ticket-api-config.json', '/api/tickets'],
    );
    assert(
      requests.every(
        (item) =>
          item.options.signal === signal && item.options.cache === 'no-store',
      ),
    );
  },
);
await group(
  'paged reader accepts bounded rows and large filtered total; rejects wrong echoes, counts, options and unknown modes',
  async () => {
    requests = [];
    const api = new dataModule.ApiTicketData(
      new URL('http://localhost:5176/ticket-api-config.json'),
    );
    const signal = new AbortController().signal;
    let body = { items: fixtures, total: 100000, page: 1, pageSize: 25 };
    handler = (url) =>
      url.pathname === '/ticket-api-config.json'
        ? Response.json({
            apiBaseUrl: 'http://localhost:3001',
            ticketQueryMode: 'paged',
          })
        : Response.json(
            url.pathname === '/api/tickets/options' ? options : body,
          );
    const config = await api.configuration(signal);
    assert.equal(config.mode, 'paged');
    assert.equal((await api.load(config, defaults, signal)).total, 100000);
    assert.equal(
      (await api.options(config, signal)).organizations[0].name,
      'Example Org',
    );
    const pageUrl = new URL(requests[1].url);
    assert.equal(pageUrl.pathname, '/api/tickets/query');
    assert.equal(pageUrl.searchParams.get('pageSize'), '25');
    for (const patch of [
      { page: 2 },
      { pageSize: 50 },
      { total: -1 },
      { total: 2 },
      {
        total: 100000,
        items: Array.from({ length: 26 }, (_, i) => ({
          ...fixtures[0],
          number: 'PS-' + (i + 1),
        })),
      },
    ]) {
      body = {
        items: fixtures,
        total: 100000,
        page: 1,
        pageSize: 25,
        ...patch,
      };
      await assert.rejects(api.load(config, defaults, signal));
    }
    assert.throws(() =>
      query.parseTicketOptions({
        organizations: [options.organizations[0], options.organizations[0]],
        assignees: [],
      }),
    );
    assert.throws(() =>
      query.parseTicketOptions({
        organizations: Array(1001).fill(options.organizations[0]),
        assignees: [],
      }),
    );
    handler = () =>
      Response.json({
        apiBaseUrl: 'http://localhost:3001',
        ticketQueryMode: 'legacy',
      });
    await assert.rejects(api.configuration(signal));
  },
);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
await group(
  'actual NgRx store cancels superseded calls, ignores stale completion, resets page and retries current filters',
  async () => {
    const calls = [];
    const fake = {
      configuration: async () => ({
        baseUrl: 'http://localhost:3001',
        mode: 'paged',
      }),
      options: async () => options,
      load: (_config, selected, signal) => {
        const pending = deferred();
        calls.push({ ...pending, query: selected, signal });
        return pending.promise;
      },
    };
    const injector = angular.createEnvironmentInjector([
      { provide: dataModule.TICKET_DATA, useValue: fake },
    ]);
    const store = angular.runInInjectionContext(
      injector,
      () => new storeModule.TicketStore(),
    );
    await tick();
    assert.equal(store.mode(), 'paged');
    assert.equal(calls.length, 1);
    store.setQuery({ search: 'new query' });
    await tick();
    assert.equal(calls[0].signal.aborted, true);
    calls[1].resolve({ items: [fixtures[1]], total: 1, page: 1, pageSize: 25 });
    await tick();
    calls[0].resolve({
      items: [fixtures[0]],
      total: 100000,
      page: 1,
      pageSize: 25,
    });
    await tick();
    assert.equal(store.items()[0].number, fixtures[1].number);
    store.goToPage(2);
    await tick();
    assert.equal(calls[2].query.page, 2);
    store.setQuery({ status: 'Closed' });
    await tick();
    assert.equal(calls[3].query.page, 1);
    calls[3].reject(new Error('fixture failure'));
    await tick();
    assert.equal(store.status(), 'error');
    assert.equal(store.mode(), 'paged');
    void store.load();
    await tick();
    assert.equal(calls[4].query.status, 'Closed');
    assert.equal(calls[4].query.search, 'new query');
    store.setQuery({ createdFrom: '2025-04-01', createdTo: '2025-03-01' });
    await tick();
    assert.equal(calls[4].signal.aborted, true);
    assert.equal(calls.length, 5);
    assert.match(store.error(), /Created from/);
    store.reset();
    await tick();
    assert.equal(calls[5].query.page, 1);
    assert.equal(calls[5].query.search, '');
    injector.destroy();
    assert.equal(calls[5].signal.aborted, true);
    calls[5].resolve({ items: [fixtures[2]], total: 1, page: 1, pageSize: 25 });
    await tick();
    assert.equal(store.items().length, 0);
  },
);

await group(
  'initial options failure retains paged mode and retry recovers an empty filtered page',
  async () => {
    let failed = true;
    const queries = [];
    const fake = {
      configuration: async () => ({
        baseUrl: 'http://localhost:3001',
        mode: 'paged',
      }),
      options: async () => {
        if (failed) throw new Error('Unavailable options');
        return options;
      },
      load: async (_config, selected) => {
        queries.push(selected);
        return {
          items: [],
          total: 0,
          page: selected.page,
          pageSize: selected.pageSize,
        };
      },
    };
    const injector = angular.createEnvironmentInjector([
      { provide: dataModule.TICKET_DATA, useValue: fake },
    ]);
    try {
      const store = angular.runInInjectionContext(
        injector,
        () => new storeModule.TicketStore(),
      );
      await tick();
      assert.equal(store.status(), 'error');
      assert.equal(store.mode(), 'paged');
      failed = false;
      store.setQuery({ search: 'missing result', status: 'Closed' });
      await tick();
      assert.equal(store.status(), 'ready');
      assert.equal(store.mode(), 'paged');
      assert.equal(store.total(), 0);
      assert.equal(store.items().length, 0);
      assert.equal(queries.at(-1).search, 'missing result');
      assert.equal(queries.at(-1).status, 'Closed');
      assert.equal(store.options().organizations.length, 1);
    } finally {
      injector.destroy();
    }
  },
);
