import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Readable } from 'node:stream';
import { createNeonConnection } from './neon-connection.js';
import {
  createNeonRuntime,
  probeNeonConnection,
  readNeonRuntimeConfiguration,
} from './neon-runtime.js';
import type { PostgresRuntime } from './postgres-runtime.js';

// Optional parent-owned control channel. Never accepts credentials or arbitrary commands.
export function attachNeonStdinControl(
  input: Readable,
  runtime: Pick<PostgresRuntime, 'stop'>,
  onFailure: () => void = () => {},
): () => void {
  let active = true;
  let command = '';
  const cleanup = () => {
    if (!active) return;
    active = false;
    input.removeListener('data', onData);
    input.removeListener('end', onEnd);
    input.removeListener('error', onEnd);
    input.pause();
  };
  const stop = () => {
    cleanup();
    void runtime.stop().catch(onFailure);
  };
  const onData = (bytes: Buffer | string) => {
    // Only a single bounded ASCII line is allowed. Invalid control input stops safely.
    const buffer = typeof bytes === 'string' ? Buffer.from(bytes) : bytes;
    for (const byte of buffer) {
      if (byte === 10) {
        if (command !== 'stop' && command !== 'stop\r') onFailure();
        stop();
        return;
      }
      if ((byte !== 13 && (byte < 32 || byte > 126)) || command.length >= 8) {
        stop();
        return;
      }
      command += String.fromCharCode(byte);
    }
  };
  function onEnd() {
    stop();
  }
  input.on('data', onData);
  input.once('end', onEnd);
  input.once('error', onEnd);
  input.resume();
  return cleanup;
}

async function main() {
  const disconnect = () => {
    if (process.connected) process.disconnect?.();
  };
  const args = process.argv.slice(2);
  if (args.length !== 1 || !['check', 'serve'].includes(args[0])) {
    console.error('Use neon-main.js check or serve.');
    process.exitCode = 1;
    disconnect();
    return;
  }
  let runtime: PostgresRuntime | undefined;
  let cleanupControl: (() => void) | undefined;
  const parentDisconnected = () => {
    void runtime?.stop().catch(() => {
      console.error('Neon runtime cleanup failed.');
      process.exitCode = 1;
    });
  };
  try {
    const configuration = readNeonRuntimeConfiguration(process.env);
    if (args[0] === 'check') {
      const connection = createNeonConnection({
        environment: configuration.environment,
      });
      let interrupted = false;
      const stop = () => {
        interrupted = true;
        void connection.close().catch(() => {
          process.exitCode = 1;
        });
      };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      try {
        await probeNeonConnection(connection);
        if (!interrupted) console.log('Neon connection check passed.');
      } finally {
        try {
          await connection.close();
        } finally {
          process.removeListener('SIGINT', stop);
          process.removeListener('SIGTERM', stop);
        }
      }
    } else {
      runtime = createNeonRuntime({
        configuration,
        onShutdownFailure: () => {
          process.exitCode = 1;
        },
        onStopped: () => {
          cleanupControl?.();
          process.removeListener('disconnect', parentDisconnected);
          disconnect();
        },
      });
      if (process.connected) process.once('disconnect', parentDisconnected);
      if (process.env['NEON_CONTROL_STDIN'] === '1') {
        cleanupControl = attachNeonStdinControl(process.stdin, runtime, () => {
          console.error('Neon runtime cleanup failed.');
          process.exitCode = 1;
        });
      }
      await runtime.start();
      const port = (runtime.server.address() as { port: number }).port;
      console.log('Neon ticket server ready: http://localhost:' + port);
      process.send?.({ type: 'ready', port });
    }
  } catch {
    console.error('Neon command failed.');
    process.exitCode = 1;
    try {
      await runtime?.stop();
    } catch {
      console.error('Neon runtime cleanup failed.');
      process.exitCode = 1;
    }
    cleanupControl?.();
  } finally {
    if (!runtime || runtime.stopping) {
      process.removeListener('disconnect', parentDisconnected);
      disconnect();
    }
  }
}

// Importing this module defines helpers only: no process listeners, pool, SQL or HTTP.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main();
