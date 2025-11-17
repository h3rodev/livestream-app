import fs from 'fs'
import path from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Reuse the same mkcert certs as the Node server
const certDir = path.resolve(__dirname, '../server/certs')
const certPath = path.join(certDir, 'cert.pem')
const keyPath = path.join(certDir, 'key.pem')

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',          // so phones on LAN can reach it
    port: 5174,
    https: {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    },
  },
  preview: {
    port: 4174,
  },
})
