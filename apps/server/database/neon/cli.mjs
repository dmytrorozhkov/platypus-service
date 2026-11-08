import { open, mkdir, realpath, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  MAX_SNAPSHOT_BYTES,
  encodeSnapshot,
  decodeSnapshot,
  snapshotSha256,
  dataFingerprint,
} from './snapshot.mjs';
import { exportDatabase, importDatabase, verifyDatabase } from './transfer.mjs';
import {
  migrationConfiguration,
  withMigrationClient,
  assertMigrationIdentity,
} from './connection.mjs';

const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const fail = () => new Error('Migration command failed.');

async function snapshotPath(root, id, create) {
  if (!/^[a-z0-9][a-z0-9-]{2,47}$/.test(id ?? '')) throw fail();
  const resolvedRoot = await realpath(root);
  let parent = resolvedRoot;
  for (const component of ['.local', 'neon-migration']) {
    parent = path.join(parent, component);
    if (create) await mkdir(parent, { recursive: true });
    const info = await lstat(parent);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      (await realpath(parent)) !== parent
    )
      throw fail();
  }
  return path.join(parent, `${id}.json`);
}

export async function runMigration({
  operation,
  id,
  environment = process.env,
  root = projectRoot,
  runClient = withMigrationClient,
} = {}) {
  if (!['export', 'inspect', 'import', 'verify'].includes(operation))
    throw fail();
  const isExport = operation === 'export';
  const file = await snapshotPath(root, id, isExport);
  let snapshot;
  let bytes;
  let result = {};
  if (isExport) {
    const configuration = migrationConfiguration(operation, environment);
    // Reserve exclusively before SQL; failed exports remain unusable and are never overwritten.
    const handle = await open(file, 'wx', 0o600);
    try {
      snapshot = await runClient(configuration, async (client) => {
        await assertMigrationIdentity(client, configuration);
        return exportDatabase(client);
      });
      bytes = await encodeSnapshot(snapshot);
      if (bytes.length > MAX_SNAPSHOT_BYTES) throw fail();
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
  } else {
    const stat = await lstat(file);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size < 1 ||
      stat.size > MAX_SNAPSHOT_BYTES
    )
      throw fail();
    const handle = await open(file, 'r');
    try {
      const opened = await handle.stat();
      if (opened.size !== stat.size || !opened.isFile()) throw fail();
      bytes = Buffer.alloc(opened.size);
      let read = 0;
      while (read < bytes.length) {
        const part = await handle.read(bytes, read, bytes.length - read, read);
        if (part.bytesRead === 0) throw fail();
        read += part.bytesRead;
      }
      if ((await handle.stat()).size !== opened.size) throw fail();
    } finally {
      await handle.close();
    }
    snapshot = await decodeSnapshot(
      bytes,
      environment.MIGRATION_EXPECTED_SHA256,
    );
    if (operation !== 'inspect') {
      const configuration = migrationConfiguration(operation, environment);
      result = await runClient(configuration, async (client) => {
        await assertMigrationIdentity(client, configuration);
        return (operation === 'import' ? importDatabase : verifyDatabase)(
          client,
          snapshot,
        );
      });
    }
  }
  return {
    operation,
    snapshotId: id,
    sha256: snapshotSha256(bytes),
    dataFingerprint: dataFingerprint(snapshot),
    counts: Object.fromEntries(
      Object.entries(snapshot.data).map(([name, rows]) => [name, rows.length]),
    ),
    ...result,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  if (process.argv.length !== 4) {
    console.error(
      'Choose export, inspect, import or verify and one snapshot id.',
    );
    process.exitCode = 1;
  } else {
    runMigration({ operation: process.argv[2], id: process.argv[3] }).then(
      (result) => console.log(JSON.stringify(result)),
      () => {
        console.error(
          'Migration command failed. No automatic retry was attempted. For an uncertain import, run explicit verify before retrying.',
        );
        process.exitCode = 1;
      },
    );
  }
}
