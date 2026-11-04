import type { RemoteModuleV1 } from '@platypus/mfe-contract';

export type RemoteName = 'analytics' | 'administration' | 'support';
export interface RemoteConfiguration {
  contractVersion: 1;
  remoteEntryUrl: string;
  exposedModule: './mount';
  cssUrls: string[];
}
export interface RuntimeConfiguration {
  schemaVersion: 1;
  remotes: Record<RemoteName, RemoteConfiguration>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function absoluteHttpUrl(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('Remote URLs must be strings.');
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Remote URLs must be absolute HTTP or HTTPS URLs.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error('Remote URLs must use HTTP or HTTPS without credentials.');
  }
  return url.href;
}

export function validateConfiguration(value: unknown): RuntimeConfiguration {
  if (
    !isObject(value) ||
    value['schemaVersion'] !== 1 ||
    !isObject(value['remotes'])
  ) {
    throw new Error('Unsupported runtime configuration.');
  }
  const remotes = {} as Record<RemoteName, RemoteConfiguration>;
  for (const name of ['analytics', 'administration', 'support'] as const) {
    const remote = value['remotes'][name];
    if (
      !isObject(remote) ||
      remote['contractVersion'] !== 1 ||
      remote['exposedModule'] !== './mount' ||
      !Array.isArray(remote['cssUrls'])
    ) {
      throw new Error('Invalid configuration for ' + name + '.');
    }
    remotes[name] = {
      contractVersion: 1,
      remoteEntryUrl: absoluteHttpUrl(remote['remoteEntryUrl']),
      exposedModule: './mount',
      cssUrls: [...new Set(remote['cssUrls'].map(absoluteHttpUrl))],
    };
  }
  return { schemaVersion: 1, remotes };
}

export function validateModule(value: unknown): RemoteModuleV1 {
  if (
    !isObject(value) ||
    value['contractVersion'] !== 1 ||
    typeof value['mount'] !== 'function'
  ) {
    throw new Error(
      'The remote application does not support contract version 1.',
    );
  }
  return value as unknown as RemoteModuleV1;
}

export function validateMountHandle(
  value: unknown,
): asserts value is { unmount(): void } {
  if (!isObject(value) || typeof value['unmount'] !== 'function') {
    throw new Error('The remote application did not provide a cleanup handle.');
  }
}

interface StyleEntry {
  element: HTMLLinkElement;
  references: number;
  ready: Promise<void>;
  cancel(): void;
}

export class StylesheetRegistry {
  private readonly entries = new Map<string, StyleEntry>();

  acquire(url: string): { ready: Promise<void>; release: () => void } {
    let entry = this.entries.get(url);
    if (!entry) {
      const element = document.createElement('link');
      element.rel = 'stylesheet';
      element.href = url;
      element.dataset['psRemoteStyle'] = '';
      let cancel = () => {};
      const ready = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          element.onload = null;
          element.onerror = null;
          reject(new Error('Timed out loading the application stylesheet.'));
        }, 10000);
        cancel = () => {
          clearTimeout(timer);
          element.onload = null;
          element.onerror = null;
          reject(new Error('Stylesheet loading was cancelled.'));
        };
        element.onload = () => {
          clearTimeout(timer);
          resolve();
        };
        element.onerror = () => {
          clearTimeout(timer);
          reject(new Error('The application stylesheet could not be loaded.'));
        };
      });
      entry = { element, references: 0, ready, cancel };
      this.entries.set(url, entry);
      document.head.append(element);
    }
    const held = entry;
    held.references++;
    let released = false;
    return {
      ready: held.ready,
      release: () => {
        if (released) return;
        released = true;
        if (--held.references === 0) {
          held.cancel();
          held.element.remove();
          if (this.entries.get(url) === held) this.entries.delete(url);
        }
      },
    };
  }
}
