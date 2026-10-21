import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        // react + react-dom go into a separate chunk so the browser can cache them
        // across game updates without re-downloading the vendor bundle
        manualChunks: { vendor: ['react', 'react-dom'] },
      },
    },
  },
})
