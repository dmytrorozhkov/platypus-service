import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

const federationOutput: Plugin = {
  name: 'platypus-federation-output',
  apply: 'build',
  config: () => ({
    base: './',
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      __VUE_OPTIONS_API__: false,
      __VUE_PROD_DEVTOOLS__: false,
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
    },
    build: {
      cssCodeSplit: false,
      rolldownOptions: { output: { assetFileNames: '[name][extname]' } },
    },
  }),
};

export default defineConfig({
  plugins: [vue(), tailwindcss(), federationOutput],
  server: { strictPort: true },
});
