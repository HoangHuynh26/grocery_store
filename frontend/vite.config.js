import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Lắng nghe trên mọi giao diện mạng (Localhost, WiFi, LAN, 4G qua hotspot/router)
    port: 5173,
    watch: {
      usePolling: true,
      interval: 100
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true
      }
    }
  }
})
