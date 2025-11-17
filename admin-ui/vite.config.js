import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const certDir = path.resolve(__dirname, '../server/certs')
const certPath = path.join(certDir, 'cert.pem')
const keyPath = path.join(certDir, 'key.pem')

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    },
  },
  preview: {
    port: 4173,
  },
})
