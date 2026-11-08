import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { json, projectRoot, within } from '../aws/common.mjs';
import { main as delivery } from '../delivery/cli.mjs';
import { readCodeBuildInput } from './codebuild-input.mjs';

export async function main() {
  const execute = promisify(execFile);
  const { stdout } = await execute('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    windowsHide: true,
    timeout: 10000,
    maxBuffer: 4096,
  });
  const input = readCodeBuildInput(process.env, stdout.trim());
  const parent = path.join(projectRoot, '.local/neon-aws/codebuild');
  await mkdir(parent, { recursive: true });
  if ((await realpath(parent)) !== path.resolve(parent))
    throw new Error(
      'CodeBuild configuration root must not resolve through links.',
    );
  const directory = within(parent, path.join(parent, input.buildId));
  await mkdir(directory);
  for (const name of ['target', 'selection', 'runtime'])
    await writeFile(path.join(directory, name + '.json'), json(input[name]), {
      flag: 'wx',
      mode: 0o600,
    });
  return delivery([
    'publish-neon',
    '--target',
    path.join(directory, 'target.json'),
    '--selection',
    path.join(directory, 'selection.json'),
    '--runtime',
    path.join(directory, 'runtime.json'),
    '--allow-neon-transition',
    String(input.allowNeonTransition),
  ]);
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
)
  main().catch(() => {
    console.error(
      'CodeBuild publication stopped. Inspect bounded operation state before any retry.',
    );
    process.exitCode = 1;
  });
