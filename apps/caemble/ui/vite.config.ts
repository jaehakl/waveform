import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: 'index.html',
        runner: 'runner.html',
      },
    },
  },
  plugins: [react(), tailwindcss()],
  worker: {
    format: 'es',
  },
})
