import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 5176,
    host: true,
    strictPort: true
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    minify: 'esbuild'
  }
})
