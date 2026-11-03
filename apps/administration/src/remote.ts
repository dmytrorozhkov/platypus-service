import './styles.css';
import { createApp } from 'vue';
import type {
  MountContext,
  MountedApplication,
  RemoteModuleV1,
} from '@platypus/mfe-contract';
import App from './App.vue';

export const contractVersion = 1;
export const mount: RemoteModuleV1['mount'] = (
  context: MountContext,
): MountedApplication => {
  if (context.signal.aborted)
    throw new Error('Cannot mount an inactive application.');
  const app = createApp(App);
  app.config.errorHandler = context.onError;
  let mounted = false;
  let unmounted = false;
  const unmount = () => {
    if (unmounted) return;
    unmounted = true;
    context.signal.removeEventListener('abort', unmount);
    if (mounted) app.unmount();
  };
  context.signal.addEventListener('abort', unmount, { once: true });
  try {
    app.mount(context.container);
    mounted = true;
    return { unmount };
  } catch (error) {
    if (mounted) app.unmount();
    context.signal.removeEventListener('abort', unmount);
    throw error;
  }
};
