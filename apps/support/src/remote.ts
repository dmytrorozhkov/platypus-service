import type { ApplicationRef } from '@angular/core';
import type { MountContext, MountedApplication } from '@platypus/mfe-contract';
export const contractVersion = 1 as const;
export function mount(context: MountContext): MountedApplication {
  const host = document.createElement('ps-support');
  let disposed = false;
  let application: ApplicationRef | undefined;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    context.signal.removeEventListener('abort', cleanup);
    application?.destroy();
    application = undefined;
    host.remove();
  };
  if (context.signal.aborted) return { unmount: cleanup };
  const message = document.createElement('p');
  message.textContent = 'Opening Tickets...';
  message.setAttribute('role', 'status');
  host.append(message);
  context.container.append(host);
  context.signal.addEventListener('abort', cleanup, { once: true });
  void (async () => {
    try {
      const bootstrap = await import('./bootstrap');
      if (disposed || context.signal.aborted) return;
      const created = await bootstrap.createSupportApplication();
      if (disposed || context.signal.aborted) {
        created.destroy();
        return;
      }
      application = created;
      bootstrap.renderSupport(created, host);
    } catch (error) {
      if (disposed || context.signal.aborted) return;
      cleanup();
      context.onError(error);
    }
  })();
  return { unmount: cleanup };
}
