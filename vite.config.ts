import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_GEMINI_API_KEY || '';
  console.log('Vite Config - API Key Status:', apiKey ? `Present (length: ${apiKey.length})` : 'MISSING');
  return {
    server: {
      port: 3002,
      host: '0.0.0.0',
    },
    preview: {
      allowedHosts: [
        'ipchamistabra-production.up.railway.app',
        '.railway.app'
      ],
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8080'),
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey)
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Extract all node_modules to vendor chunk except charts
            if (id.includes('node_modules')) {
              if (id.includes('lightweight-charts') || id.includes('fancy-canvas')) {
                return 'charts';
              }
              if (id.includes('lucide-react')) {
                return 'lucide';
              }
              return 'vendor';
            }
          }
        }
      },
      target: 'esnext',
      minify: 'esbuild',
      sourcemap: false,
      // Strip console.log and console.debug in production
      esbuildOptions: {
        drop: mode === 'production' ? ['console', 'debugger'] : []
      }
    },
    optimizeDeps: {
      include: ['lucide-react', 'lightweight-charts'],
      esbuildOptions: {
        target: 'esnext'
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
