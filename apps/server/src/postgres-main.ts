import {
  createPostgresRuntime,
  readPostgresConfiguration,
  type PostgresRuntime,
} from './postgres-runtime.js';

let runtime: PostgresRuntime | undefined;
try {
  runtime = createPostgresRuntime({
    configuration: readPostgresConfiguration(process.env),
    onShutdownFailure: () => process.exit(1),
    onStopped: () => process.disconnect?.(),
  });
  await runtime.start();
  console.log(
    'PostgreSQL ticket server ready: http://localhost:' +
      (runtime.server.address() as { port: number }).port,
  );
  process.send?.({
    type: 'ready',
    port: (runtime.server.address() as { port: number }).port,
  });
} catch (failure) {
  const interrupted = runtime?.stopping ?? false;
  if (!interrupted) {
    // Configuration diagnostics are fixed messages; connection failures never print supplied values.
    console.error(
      runtime === undefined && failure instanceof Error
        ? failure.message
        : 'PostgreSQL ticket server could not start.',
    );
    process.exitCode = 1;
  }
  try {
    await runtime?.stop();
  } catch {
    console.error('PostgreSQL ticket server cleanup failed.');
    process.exit(1);
  }
} finally {
  // A launcher must not keep an interrupted owned child alive through its IPC channel.
  if (runtime?.stopping) process.disconnect?.();
}
