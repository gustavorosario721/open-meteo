const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
  root: __dirname,
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  optimizeDeps: {
    noDiscovery: true
  },
  build: {
    outDir: path.resolve(__dirname, '../dist'),
    emptyOutDir: true
  }
});
