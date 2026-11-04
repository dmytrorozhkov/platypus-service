import { startApplication } from './serve-local.mjs';
import { startShell, stopChild } from './serve-shell.mjs';

const preview = process.argv.includes('--preview');
const servers = [];
let shell;
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  stopChild(shell);
  for (const server of servers) server.closeAllConnections();
  for (const server of servers) server.close();
  process.exitCode = code;
}
try {
  servers.push(await startApplication('analytics'));
  servers.push(await startApplication('administration'));
  servers.push(await startApplication('support'));
  if (preview) servers.push(await startApplication('shell'));
  else {
    shell = await startShell();
    shell.on('error', (error) => {
      console.error('Shell startup failed.', error.message);
      stop(1);
    });
    shell.on('exit', (code) => {
      if (!stopping) stop(code ?? 1);
    });
  }
  process.on('SIGINT', () => stop());
  process.on('SIGTERM', () => stop());
} catch (error) {
  console.error(
    'Workspace could not start. Build remotes first and ensure ports 4200, 4301, 4302, and 4303 are free.',
    error.message,
  );
  stop(1);
}
