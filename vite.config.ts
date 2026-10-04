import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        onwarn(warning, defaultHandler) {
          if (
            warning.code === 'MODULE_LEVEL_DIRECTIVE' ||
            (warning.message && warning.message.includes('"use client"'))
          ) {
            return;
          }
          defaultHandler(warning);
        },
      },
    },
    server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true as const,
  },
  };
});
