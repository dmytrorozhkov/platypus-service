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

export async function startAngular(name = 'shell', port = 4200) {
  if (!['shell', 'support'].includes(name))
    throw new Error('Unsupported Angular application.');
  const probe = createServer();
  try {
    await new Promise((resolve, reject) => {
      probe.once('error', reject);
      probe.listen(port, 'localhost', resolve);
    });
    await new Promise((resolve) => probe.close(resolve));
  } catch {
    throw new Error(
      name +
        ' port ' +
        port +
        ' is occupied. Stop its current server before starting it.',
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
      String(port),
    ],
    {
      cwd: path.join(projectRoot, 'apps', name),
      stdio: 'inherit',
      windowsHide: true,
      // Non-interactive mode prevents Angular from offering a different port after a race.
      env: { ...process.env, CI: 'true', NG_CLI_ANALYTICS: 'false' },
    },
  );
}

export function startShell() {
  return startAngular('shell', 4200);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const child = await (process.argv[2] === 'support'
      ? startAngular('support', 5175)
      : startShell());
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
