import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  plugins: [
    {
      name: 'rewrite-99',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Jika user buka /99, paksa Vite tampilkan rahasia_admin.html
          if (req.url === '/99') {
            req.url = '/rahasia_admin.html';
          }
          next();
        });
      }
    }
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'rahasia_admin.html'),
      },
    },
  },
});
