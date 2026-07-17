import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // amazon-cognito-identity-js's bundled deps (buffer) reference the
  // Node global `global`, which doesn't exist in the browser -- confirmed
  // needed in practice (not just defensive), Vite's dep pre-bundling
  // doesn't polyfill it automatically.
  define: {
    global: 'globalThis',
  },
})
