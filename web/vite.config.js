import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const page = (file) => fileURLToPath(new URL(file, import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Several pages: the NGO dashboard plus the vet desk, adoption desk
    // and public adoption portal
    rollupOptions: {
      input: {
        main: page('./index.html'),
        vet: page('./vet.html'),
        adoptionDesk: page('./adoption-desk.html'),
        adopt: page('./adopt.html'),
        donate: page('./donate.html'),
      },
    },
  },
})
