import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/ws': { target: 'ws://localhost:8081', ws: true },
      '/health': { target: 'http://localhost:8081' },
    },
  },
})
