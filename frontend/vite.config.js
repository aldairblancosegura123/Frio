import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'src',
  envDir: '..',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'src/index.html'),
        cliente: resolve(__dirname, 'src/cliente.html'),
        equipos: resolve(__dirname, 'src/equipos.html'),
        agenda: resolve(__dirname, 'src/agenda.html'),
        register: resolve(__dirname, 'src/register.html'),
      },
    },
  },
})
