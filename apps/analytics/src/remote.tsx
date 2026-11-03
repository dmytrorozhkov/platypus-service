import './styles.css';
import { createRoot } from 'react-dom/client';
import type {
  MountContext,
  MountedApplication,
  RemoteModuleV1,
} from '@platypus/mfe-contract';
import { App } from './App';

export const contractVersion = 1;
export const mount: RemoteModuleV1['mount'] = (
  context: MountContext,
): MountedApplication => {
  if (context.signal.aborted)
    throw new Error('Cannot mount an inactive application.');
  const root = createRoot(context.container, {
    onUncaughtError: context.onError,
  });
  let unmounted = false;
  const unmount = () => {
    if (unmounted) return;
    unmounted = true;
    context.signal.removeEventListener('abort', unmount);
    root.unmount();
  };
  context.signal.addEventListener('abort', unmount, { once: true });
  try {
    root.render(<App />);
    return { unmount };
  } catch (error) {
    unmount();
    throw error;
  }
};
