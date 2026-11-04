import { withNativeFederation } from '@angular-architects/native-federation/config';
export default withNativeFederation({
  name: 'support',
  exposes: { './mount': './src/remote.ts' },
  shared: {},
  sharedMappings: [],
});
