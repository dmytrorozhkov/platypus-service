import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectRoot } from './serve-local.mjs';

export function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    const terminator = spawn(
      'taskkill.exe',
      ['/pid', String(child.pid), '/t', '/f'],
      { stdio: 'ignore', windowsHide: true },
    );
    terminator.on('error', () => child.kill());
  } else child.kill('SIGTERM');
}

export async function startShell() {
  const probe = createServer();
  try {
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(4200, 'localhost', resolve);
    });
    await new Promise((resolve) => probe.close(resolve));
  } catch {
    throw new Error(
      'Shell port 4200 is occupied. Stop its current server before starting Shell.',
    );
  }
  return spawn(
    process.execPath,
    [
      path.join(projectRoot, 'node_modules/@angular/cli/bin/ng.js'),
      'serve',
      '--host',
      'localhost',
      '--port',
      '4200',
    ],
    {
      cwd: path.join(projectRoot, 'apps/shell'),
      stdio: 'inherit',
      windowsHide: true,
      // Non-interactive mode prevents Angular from offering a different port after a race.
      env: { ...process.env, CI: 'true', NG_CLI_ANALYTICS: 'false' },
    },
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const child = await startShell();
    child.on('error', (error) => {
      console.error('Shell failed.', error.message);
      process.exitCode = 1;
    });
    child.on('exit', (code) => {
      process.exitCode = code ?? 0;
    });
    process.on('SIGINT', () => stopChild(child));
    process.on('SIGTERM', () => stopChild(child));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
