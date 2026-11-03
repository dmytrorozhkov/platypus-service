import { withNativeFederation } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'analytics',
  exposes: { './mount': './src/remote.tsx' },
  shared: {},
  sharedMappings: [],
});
