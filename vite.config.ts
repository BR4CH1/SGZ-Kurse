import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/SGZ-Kurse/',
  plugins: [react()],
  server: {
    host: true,
  },
})
