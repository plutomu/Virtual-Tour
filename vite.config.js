import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    {
      name: 'router-99',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url.split('?')[0];
          
          // Jika browser memaksa ke admin.html (karena cache lama), lempar balik ke /99
          if (url === '/admin.html') {
            res.writeHead(302, { Location: '/99' });
            res.end();
            return;
          }

          // Internal rewrite: Tampilkan isi rahasia_admin.html di alamat /99
          if (url === '/99' || url === '/99/') {
            req.url = '/rahasia_admin.html';
          }
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        admin: 'rahasia_admin.html',
      },
    },
  },
});
