import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  cacheControl,
  contentType,
  files,
  flags,
  json,
  origin,
  outputRoot,
  ownedManifest,
  project,
  projectRoot,
  releaseId,
  remotes,
  sha256,
  within,
} from './common.mjs';

export async function prepareRelease({
  release,
  deploymentOrigin = 'https://deployment.invalid',
  remote,
  previous,
}) {
  releaseId(release);
  origin(deploymentOrigin);
  if (remote && !remotes.includes(remote)) throw new Error('Unknown remote.');
  if (Boolean(remote) !== Boolean(previous))
    throw new Error(
      'Remote preparation requires exactly one previous manifest.',
    );
  const old = previous ? await ownedManifest(previous) : undefined;
  if (old && old.value.origin !== deploymentOrigin)
    throw new Error('Remote updates cannot change the deployment origin.');
  const directory = within(
    outputRoot,
    path.join(outputRoot, 'releases', release),
  );
  await mkdir(outputRoot, { recursive: true });
  if ((await realpath(outputRoot)) !== outputRoot)
    throw new Error('Output root must not resolve through links.');
  await mkdir(path.dirname(directory), { recursive: true });
  await mkdir(directory); // Never overwrite an existing release, even one from a failed attempt.
  await writeFile(
    path.join(directory, 'owner.json'),
    json({ project, release }),
  );
  const objects = [];
  const backendFiles = {};
  async function object(key, body, app) {
    const destination = within(
      directory,
      path.join(directory, 'objects', ...key.split('/')),
    );
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, body, { flag: 'wx' });
    objects.push({
      key,
      file: path.relative(directory, destination).replaceAll('\\', '/'),
      sha256: sha256(body),
      bytes: Buffer.byteLength(body),
      contentType: contentType(key),
      cacheControl: cacheControl(key),
      app,
    });
  }
  const references = structuredClone(old?.value.references ?? {});
  const apps = structuredClone(old?.value.apps ?? {});
  for (const app of remote ? [remote] : remotes) {
    const buildDirectory = path.join(
      projectRoot,
      'apps',
      app,
      'dist',
      app === 'support' ? 'browser' : 'remote',
    );
    const list = await files(buildDirectory);
    if (!list.includes('remoteEntry.json'))
      throw new Error('Build missing federation metadata: ' + app);
    const metadata = JSON.parse(
      await readFile(path.join(buildDirectory, 'remoteEntry.json'), 'utf8'),
    );
    if (
      metadata.name !== app ||
      metadata.shared.length !== 0 ||
      !metadata.exposes.some(
        (item) => item.key === './mount' && list.includes(item.outFileName),
      )
    )
      throw new Error('Unexpected federation contract: ' + app);
    const prefix = `mfe/${app}/${release}/`;
    const graph = [];
    for (const file of list) {
      // Standalone documents use a different base href; the integrated release has no standalone HTML.
      if (file.endsWith('.html')) continue;
      let body = await readFile(path.join(buildDirectory, file));
      if (app === 'support' && file === 'ticket-api-config.json')
        body = Buffer.from(json({ apiBaseUrl: deploymentOrigin }));
      await object(prefix + file, body, app);
      graph.push({ file, sha256: sha256(body) });
    }
    apps[app] = {
      release,
      graphSha256: sha256(json(graph)),
      objects: graph.map((item) => ({
        key: prefix + item.file,
        sha256: item.sha256,
      })),
    };
    references[app] = {
      contractVersion: 1,
      exposedModule: './mount',
      remoteEntryUrl: deploymentOrigin + '/' + prefix + 'remoteEntry.json',
      cssUrls: [
        deploymentOrigin +
          '/' +
          prefix +
          (app === 'support' ? 'styles.css' : 'style.css'),
      ],
    };
  }
  const runtime = { schemaVersion: 1, remotes: references };
  if (!remote) {
    const directory = path.join(
      projectRoot,
      'apps',
      'shell',
      'dist',
      'browser',
    );
    const graph = [];
    for (const file of await files(directory)) {
      if (file === 'runtime-config.json') continue;
      const body = await readFile(path.join(directory, file));
      await object(file, body, 'shell');
      graph.push({ file, sha256: sha256(body) });
    }
    apps.shell = { release, graphSha256: sha256(json(graph)) };
  }
  await object('runtime-config.json', json(runtime), 'configuration');
  await object(
    `_releases/${release}/runtime-config.json`,
    json(runtime),
    'rollback',
  );
  if (!remote) {
    await object(
      `_releases/${release}/index.html`,
      await readFile(
        path.join(projectRoot, 'apps/shell/dist/browser/index.html'),
      ),
      'rollback',
    );
    const packageDirectory = path.join(directory, 'lambda');
    await mkdir(packageDirectory);
    const packageFiles = [
      'lambda.js',
      'ticket-application.js',
      'ticket-repository.js',
      'fixtures/tickets.json',
    ];
    for (const filename of packageFiles) {
      const destination = path.join(packageDirectory, filename);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(
        destination,
        await readFile(path.join(projectRoot, 'apps/server/dist', filename)),
        { flag: 'wx' },
      );
    }
    await writeFile(
      path.join(packageDirectory, 'package.json'),
      json({ name: '@platypus/lambda-release', private: true, type: 'module' }),
      { flag: 'wx' },
    );
    const archive = path.join(directory, 'backend.zip');
    const extract = path.join(directory, 'lambda-extracted');
    const script = await readFile(
      new URL('./archive.ps1', import.meta.url),
      'utf8',
    );
    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      {
        env: {
          ...process.env,
          PLATYPUS_PACKAGE_SOURCE: packageDirectory,
          PLATYPUS_PACKAGE_ARCHIVE: archive,
          PLATYPUS_PACKAGE_EXTRACT: extract,
        },
        encoding: 'utf8',
      },
    );
    if (result.status !== 0)
      throw new Error(
        'Standard ZIP creation/extraction failed: ' +
          (result.stderr || result.error?.message),
      );
    const expected = [...packageFiles, 'package.json'].sort();
    if (
      JSON.stringify((await files(extract)).sort()) !== JSON.stringify(expected)
    )
      throw new Error('Extracted ZIP contents differ.');
    for (const filename of expected) {
      const hash = sha256(await readFile(path.join(extract, filename)));
      if (
        hash !== sha256(await readFile(path.join(packageDirectory, filename)))
      )
        throw new Error('ZIP extraction changed ' + filename);
      backendFiles[filename] = hash;
    }
    await object(
      `_deploy/backend/${release}.zip`,
      await readFile(archive),
      'backend',
    );
  }
  const value = {
    schemaVersion: 1,
    project,
    release,
    origin: deploymentOrigin,
    scope: remote ?? 'full',
    previous: old?.value.release ?? null,
    apps,
    references,
    objects,
    backend: remote
      ? old.value.backend
      : {
          key: `_deploy/backend/${release}.zip`,
          sha256: objects.find((item) => item.app === 'backend').sha256,
          codeSha256: Buffer.from(
            objects.find((item) => item.app === 'backend').sha256,
            'hex',
          ).toString('base64'),
          files: backendFiles,
        },
  };
  await writeFile(path.join(directory, 'manifest.json'), json(value), {
    flag: 'wx',
  });
  return { directory, value };
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  try {
    const options = flags(process.argv.slice(2), [
      '--release',
      '--origin',
      '--remote',
      '--previous',
    ]);
    const result = await prepareRelease({
      release: options['--release'],
      deploymentOrigin: options['--origin'],
      remote: options['--remote'],
      previous: options['--previous'],
    });
    console.log(
      'Prepared offline release: ' +
        path.join(result.directory, 'manifest.json'),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
