import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiKey = env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || '';
  console.log('Vite Config - API Key Status:', apiKey ? `Present (length: ${apiKey.length})` : 'MISSING');
  console.log('Vite Config - Full key (first 20 chars):', apiKey.substring(0, 20));
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
          manualChunks: {
            'lucide': ['lucide-react'],
            'charts': ['lightweight-charts']
          }
        }
      },
      target: 'esnext',
      minify: 'esbuild'
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
