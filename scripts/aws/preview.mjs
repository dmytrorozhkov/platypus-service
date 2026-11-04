import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { flags, isPublicKey, ownedManifest } from './common.mjs';
import { rewriteCode } from './templates.mjs';

export async function startPreview({ manifest, previous }) {
  const releases = [];
  if (previous) releases.push(await ownedManifest(previous));
  const latest = await ownedManifest(manifest);
  releases.push(latest);
  const configuration = new URL(latest.value.origin);
  if (
    configuration.protocol !== 'http:' ||
    configuration.hostname !== 'localhost' ||
    !configuration.port
  )
    throw new Error(
      'Preview needs a separately prepared http://localhost:<port> release.',
    );
  if (releases.some((item) => item.value.origin !== latest.value.origin))
    throw new Error('Overlay origins differ.');
  const full = releases.find((item) => item.value.scope === 'full');
  if (!full)
    throw new Error(
      'Preview needs a full release for the packaged handler and Shell.',
    );
  const { createLambdaHandler } = await import(
    pathToFileURL(path.join(full.directory, 'lambda-extracted', 'lambda.js'))
      .href
  );
  const { FixtureTicketRepository } = await import(
    pathToFileURL(
      path.join(full.directory, 'lambda-extracted', 'ticket-repository.js'),
    ).href
  );
  const handler = createLambdaHandler({
    repository: new FixtureTicketRepository(),
    allowedOrigins: [latest.value.origin],
  });
  const route = runInNewContext(
    rewriteCode + '\nhandler;',
    {},
    { timeout: 1000 },
  );
  const objects = new Map();
  for (const release of releases)
    for (const object of release.value.objects)
      objects.set('/' + object.key, {
        ...object,
        filename: path.join(release.directory, object.file),
      });
  const server = createServer(async (request, response) => {
    try {
      const requested = (request.url ?? '/').split('?')[0];
      if (request.headers.host !== configuration.host) {
        response
          .writeHead(421, { 'Cache-Control': 'no-store' })
          .end('Unexpected host');
        return;
      }
      if (requested.startsWith('/api/')) {
        const result = await handler({
          version: '2.0',
          rawPath: requested,
          headers: request.headers,
          requestContext: { http: { method: request.method, path: requested } },
        });
        response
          .writeHead(result.statusCode, result.headers)
          .end(request.method === 'HEAD' ? undefined : result.body);
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response
          .writeHead(405, { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' })
          .end();
        return;
      }
      if (/%|\\|\.\.|\0/.test(requested)) {
        response
          .writeHead(404, {
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-store',
          })
          .end('Not found');
        return;
      }
      const routed = route({ request: { uri: requested } });
      const object = routed.uri ? objects.get(routed.uri) : undefined;
      if (!object || !isPublicKey(object.key)) {
        response
          .writeHead(404, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
          })
          .end('Not found');
        return;
      }
      response.writeHead(200, {
        'Content-Type': object.contentType,
        'Cache-Control': object.cacheControl,
        'X-Content-Type-Options': 'nosniff',
        ETag: '"' + object.sha256 + '"',
      });
      response.end(
        request.method === 'HEAD' ? undefined : await readFile(object.filename),
      );
    } catch (error) {
      console.error('Packaged preview request failed.', error.message);
      if (!response.headersSent)
        response.writeHead(500, { 'Cache-Control': 'no-store' });
      response.end('Preview failed');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(Number(configuration.port), 'localhost', resolve);
  });
  return {
    server,
    origin: latest.value.origin,
    stop: () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const options = flags(process.argv.slice(2), ['--manifest', '--previous']);
    const preview = await startPreview({
      manifest: options['--manifest'],
      previous: options['--previous'],
    });
    console.log(
      'Offline packaged preview: ' + preview.origin + '/support/tickets',
    );
    for (const signal of ['SIGINT', 'SIGTERM'])
      process.once(signal, () => {
        void preview.stop();
      });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
