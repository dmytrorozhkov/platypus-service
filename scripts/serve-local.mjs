import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const applications = {
  support: { root: 'apps/support/dist/browser', port: 4303, fallback: false },
  'support-standalone': {
    root: 'apps/support/dist/browser',
    port: 5175,
    fallback: true,
  },
  'support-large': {
    root: 'apps/support/dist/browser',
    port: 5176,
    fallback: true,
    ticketApiConfig: {
      apiBaseUrl: 'http://localhost:3001',
      ticketQueryMode: 'paged',
    },
  },
  shell: { root: 'apps/shell/dist/browser', port: 4200, fallback: true },
  analytics: {
    root: 'apps/analytics/dist/remote',
    port: 4301,
    fallback: false,
  },
  administration: {
    root: 'apps/administration/dist/remote',
    port: 4302,
    fallback: false,
  },
};
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export async function createStaticServer({
  root,
  fallback = false,
  ticketApiConfig,
}) {
  const canonicalRoot = await realpath(root);
  function insideRoot(candidate) {
    return (
      candidate === canonicalRoot ||
      candidate.startsWith(canonicalRoot + path.sep)
    );
  }
  return createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.headers.origin === 'http://localhost:4200') {
      response.setHeader(
        'Access-Control-Allow-Origin',
        'http://localhost:4200',
      );
    }
    response.setHeader('Vary', 'Origin');
    if (request.method === 'OPTIONS') {
      response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      response.writeHead(204).end();
      return;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD, OPTIONS');
      response.writeHead(405).end('Method not allowed.');
      return;
    }
    try {
      let pathname;
      try {
        pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
      } catch {
        response.writeHead(400).end('Invalid path.');
        return;
      }
      const segments = pathname.split(/[\\/]/);
      if (
        !pathname.startsWith('/') ||
        pathname.includes('\0') ||
        segments.includes('..') ||
        segments.includes('.')
      ) {
        response.writeHead(400).end('Invalid path.');
        return;
      }
      if (ticketApiConfig && pathname === '/ticket-api-config.json') {
        const body = Buffer.from(JSON.stringify(ticketApiConfig));
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Content-Length', body.length);
        response
          .writeHead(200)
          .end(request.method === 'HEAD' ? undefined : body);
        return;
      }
      let candidate = path.resolve(canonicalRoot, '.' + pathname);
      if (!insideRoot(candidate)) {
        response.writeHead(403).end('Forbidden.');
        return;
      }
      if (pathname.endsWith('/'))
        candidate = path.join(candidate, 'index.html');
      let metadata;
      try {
        metadata = await stat(candidate);
      } catch (error) {
        if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
        if (fallback && path.extname(pathname) === '') {
          candidate = path.join(canonicalRoot, 'index.html');
          metadata = await stat(candidate);
        } else {
          response.writeHead(404).end('Not found.');
          return;
        }
      }
      if (!metadata.isFile() || !insideRoot(await realpath(candidate))) {
        response.writeHead(404).end('Not found.');
        return;
      }
      const body = await readFile(candidate);
      response.setHeader(
        'Content-Type',
        contentTypes[path.extname(candidate)] ?? 'application/octet-stream',
      );
      response.setHeader('Content-Length', body.length);
      response.writeHead(200).end(request.method === 'HEAD' ? undefined : body);
    } catch (error) {
      console.error('Local static request failed.', error);
      if (!response.headersSent) response.writeHead(500);
      response.end('Local server error.');
    }
  });
}

export async function startApplication(name) {
  const configuration = applications[name];
  if (!configuration)
    throw new Error(
      'Choose shell, analytics, administration, support, support-standalone, or support-large.',
    );
  const server = await createStaticServer({
    root: path.join(projectRoot, configuration.root),
    fallback: configuration.fallback,
    ticketApiConfig: configuration.ticketApiConfig,
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(configuration.port, 'localhost', resolve);
  });
  console.log(name + ' ready: http://localhost:' + configuration.port);
  return server;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startApplication(process.argv[2]).catch((error) => {
    console.error(
      'Local server could not start. Build the application and ensure its reserved port is free.',
      error.message,
    );
    process.exitCode = 1;
  });
}
