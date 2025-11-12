import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-beautiful-dnd': resolve(__dirname, 'src/vendor/react-beautiful-dnd'),
      mousetrap: resolve(__dirname, 'src/vendor/mousetrap')
    }
  },
  server: {
    host: true,
    port: 5173
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts'
  }
});
