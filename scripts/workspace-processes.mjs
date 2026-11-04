import { startApplication } from './serve-local.mjs';
import { startShell, stopChild } from './serve-shell.mjs';
import { startTicketServer } from './server-process.mjs';

// Dependency boundaries let lifecycle tests hold a real listener acquisition.
export function createWorkspace({
  preview = false,
  startStatic = startApplication,
  startShellProcess = startShell,
  startApi = startTicketServer,
  stopProcess = stopChild,
} = {}) {
  const servers = [];
  let shell;
  let ticketServer;
  let stopping = false;
  let exitCode = 0;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    exitCode = code;
    stopProcess(shell);
    stopProcess(ticketServer);
    for (const server of servers) server.closeAllConnections();
    for (const server of servers) server.close();
  }
  async function startOwnedApplication(name) {
    if (stopping) throw new Error('Workspace startup was cancelled.');
    const server = await startStatic(name);
    if (stopping) {
      server.closeAllConnections();
      server.close();
      throw new Error('Workspace startup was cancelled.');
    }
    servers.push(server);
  }
  const ready = (async () => {
    try {
      ticketServer = await startApi();
      if (stopping) {
        stopProcess(ticketServer);
        return;
      }
      ticketServer.on('exit', () => {
        if (!stopping)
          console.error(
            'Ticket server stopped. Frontends remain available; restart the server and select Retry.',
          );
      });
      await startOwnedApplication('analytics');
      await startOwnedApplication('administration');
      await startOwnedApplication('support');
      if (preview) await startOwnedApplication('shell');
      else {
        shell = await startShellProcess();
        if (stopping) stopProcess(shell);
        shell.on('error', (error) => {
          console.error('Shell startup failed.', error.message);
          stop(1);
        });
        shell.on('exit', (code) => {
          if (!stopping) stop(code ?? 1);
        });
      }
    } catch (error) {
      stop(1);
      throw error;
    }
  })();
  return {
    ready,
    stop,
    get exitCode() {
      return exitCode;
    },
  };
}
