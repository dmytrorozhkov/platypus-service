import 'es-module-shims';
import {
  initFederation,
  type NativeFederationResult,
} from '@softarc/native-federation-orchestrator';
import { useShimImportMap } from '@softarc/native-federation-orchestrator/options';
import type { RemoteConfiguration, RemoteName } from './runtime';

const federations = new Map<RemoteName, Promise<NativeFederationResult>>();
const initialized = new Map<string, { url: string; ready: Promise<void> }>();

function orchestrator(name: RemoteName): Promise<NativeFederationResult> {
  const existing = federations.get(name);
  if (existing) return existing;
  const shim = useShimImportMap({ shimMode: true });
  const federation = initFederation(
    {},
    {
      hostRemoteEntry: false,
      storageNamespace: '__PLATYPUS_' + name.toUpperCase() + '__',
      ...shim,
      // Each remote has private dependencies and state; never clear another remote's map.
      setImportMapFn: (map) => shim.setImportMapFn(map, { override: false }),
      strict: true,
      logLevel: 'error',
    },
  ).catch((error: unknown) => {
    if (federations.get(name) === federation) federations.delete(name);
    throw error;
  });
  federations.set(name, federation);
  return federation;
}

export async function loadFederatedModule(
  name: RemoteName,
  configuration: RemoteConfiguration,
): Promise<unknown> {
  const runtime = await orchestrator(name);
  let registration = initialized.get(name);
  if (registration && registration.url !== configuration.remoteEntryUrl) {
    throw new Error(
      'This section has a new deployment address. Reload the page to use it.',
    );
  }
  if (!registration) {
    // Remotes have no shared dependencies; a slow metadata fetch must not block another route.
    const ready = (async () => {
      await runtime.initRemoteEntry(configuration.remoteEntryUrl, name);
    })();
    registration = { url: configuration.remoteEntryUrl, ready };
    initialized.set(name, registration);
    const current = registration;
    void ready.catch(() => {
      if (initialized.get(name) === current) initialized.delete(name);
    });
  }
  await registration.ready;
  return runtime.loadRemoteModule(name, configuration.exposedModule);
}
