import tailwindcss from '@tailwindcss/vite';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const federationOutput: Plugin = {
  name: 'platypus-federation-output',
  apply: 'build',
  config: () => ({
    base: './',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      cssCodeSplit: false,
      rolldownOptions: { output: { assetFileNames: '[name][extname]' } },
    },
  }),
};

export default defineConfig({
  plugins: [react(), tailwindcss(), federationOutput],
  server: { strictPort: true },
});
