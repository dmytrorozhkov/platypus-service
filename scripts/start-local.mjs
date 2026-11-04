import { createWorkspace } from './workspace-processes.mjs';

const workspace = createWorkspace({
  preview: process.argv.includes('--preview'),
});
process.on('SIGINT', () => workspace.stop());
process.on('SIGTERM', () => workspace.stop());
process.on('beforeExit', () => {
  process.exitCode = workspace.exitCode;
});
try {
  await workspace.ready;
} catch (error) {
  console.error(
    'Workspace could not start. Build the workspaces first and ensure the configured API port (default 3000), 4200, 4301, 4302, and 4303 are free.',
    error.message,
  );
}
