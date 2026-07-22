import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR desativado quando DISABLE_HMR=true (ambiente de edição do agente)
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy para o backend Flask em desenvolvimento
      // O Vite serve o frontend em :5173, o Flask roda em :5000
      proxy: isDev ? {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      } : undefined,
    },
    build: {
      // Diretório de saída do build (Flask serve a partir daqui)
      outDir: 'dist',
      sourcemap: false,
      // Separar chunks grandes para melhor performance
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react', 'motion'],
            auth: ['@stackframe/stack'],
          },
        },
      },
    },
  };
});
