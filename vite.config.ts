import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const rawSupabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const normalizedSupabaseUrl = rawSupabaseUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(normalizedSupabaseUrl),
      'import.meta.env.DEMO_MODE': JSON.stringify(
        process.env.DEMO_MODE === 'true' ||
          process.env.VITE_DEMO_MODE === 'true' ||
          process.env.DEMO_MODE === '1'
          ? 'true'
          : 'false'
      ),
      'import.meta.env.VITE_DEMO_MODE': JSON.stringify(
        process.env.DEMO_MODE === 'true' ||
          process.env.VITE_DEMO_MODE === 'true' ||
          process.env.DEMO_MODE === '1'
          ? 'true'
          : 'false'
      ),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: false,
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: null,
    },
  };
});
