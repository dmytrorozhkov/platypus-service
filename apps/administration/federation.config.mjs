import { withNativeFederation } from '@softarc/native-federation/config';

export default withNativeFederation({
  name: 'administration',
  exposes: { './mount': './src/remote.ts' },
  shared: {},
  sharedMappings: [],
});
