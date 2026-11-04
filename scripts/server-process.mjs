import { spawn } from 'node:child_process';
import path from 'node:path';
import { projectRoot } from './serve-local.mjs';

export function startTicketServer(environment = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(projectRoot, 'apps/server/dist/main.js')],
      {
        cwd: path.join(projectRoot, 'apps/server'),
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
        windowsHide: true,
        env: { ...process.env, ...environment },
      },
    );
    child.once('error', reject);
    child.once('exit', (code) =>
      reject(new Error('Ticket server exited before startup: ' + code)),
    );
    child.once('message', (message) => {
      if (message?.type === 'ready') resolve(child);
    });
  });
}
