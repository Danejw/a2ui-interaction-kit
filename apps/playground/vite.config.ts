import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES === 'true' ? '/a2ui-interaction-kit/' : '/',
  server: {port: 4173, strictPort: true},
  preview: {port: 4173, strictPort: true},
  build: {outDir: '../../site-dist', emptyOutDir: true},
});
