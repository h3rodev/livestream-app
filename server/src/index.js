// server/src/index.js
import fs from 'fs'
import path from 'path'
import https from 'https'
import express from 'express'
import { Server as SocketIOServer } from 'socket.io'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

// --- Basic CORS ---
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(200)
  next()
})

// --- Static files (optional) ---
const publicDir = path.join(__dirname, '..', 'public')
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir))
}

// --- API: Upload recording ---
app.post('/api/upload-recording', (req, res) => {
  const {
    cameraId = 'unknown',
    startedAt,
    endedAt,
    durationSeconds,
    filename,
  } = req.query

  const safeCameraId = String(cameraId).replace(/[^a-zA-Z0-9_-]/g, '') || 'unknown'
  const safeFilename =
    (filename && String(filename).replace(/[^a-zA-Z0-9_.-]/g, '')) ||
    `rec-${Date.now()}.webm`

  const recordingsRoot = path.join(__dirname, '..', 'recordings')
  const cameraDir = path.join(recordingsRoot, safeCameraId)

  try {
    fs.mkdirSync(cameraDir, { recursive: true })
  } catch (err) {
    console.error('[UPLOAD] mkdir failed', err)
    return res.status(500).json({ ok: false, error: 'mkdir_failed' })
  }

  const videoPath = path.join(cameraDir, safeFilename)
  const metaPath = videoPath.replace(/\.webm$/i, '.json')

  const writeStream = fs.createWriteStream(videoPath)
  req.pipe(writeStream)

  writeStream.on('finish', () => {
    const meta = {
      cameraId: safeCameraId,
      startedAt: startedAt || null,
      endedAt: endedAt || null,
      durationSeconds: durationSeconds ? Number(durationSeconds) : null,
      file: path.basename(videoPath),
      uploadedAt: new Date().toISOString(),
    }

    fs.writeFile(metaPath, JSON.stringify(meta, null, 2), (err) => {
      if (err) console.error('[UPLOAD] Failed to write meta file', err)
    })

    console.log(
      `[UPLOAD] Saved recording for camera ${safeCameraId}: ${videoPath}`,
    )
    res.json({ ok: true, file: path.basename(videoPath) })
  })

  writeStream.on('error', (err) => {
    console.error('[UPLOAD] Write stream error', err)
    res.status(500).json({ ok: false, error: 'write_failed' })
  })
})

// --- HTTPS CERTS (mkcert) ---
const certDir = path.join(__dirname, '..', 'certs')
const keyPath = path.join(certDir, 'key.pem')
const certPath = path.join(certDir, 'cert.pem')

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error(
    'Missing HTTPS certs. Run mkcert and place key.pem/cert.pem in server/certs',
  )
  process.exit(1)
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
}

const server = https.createServer(httpsOptions, app)
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

// --- In-memory tracking of admins and cameras ---
const admins = new Set()
const cameras = new Map() // socketId -> { role: 'camera' }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id)

  socket.on('join', ({ role }) => {
    if (role === 'admin') {
      console.log('Socket', socket.id, 'joined as admin')
      admins.add(socket.id)
      socket.emit(
        'info',
        `Joined as admin. Current cameras: ${Array.from(cameras.keys()).join(', ')}`,
      )
      // Send currently known cameras
      cameras.forEach((_info, camId) => {
        socket.emit('camera-joined', { cameraId: camId })
      })
    } else if (role === 'camera') {
      console.log('Socket', socket.id, 'joined as camera')
      cameras.set(socket.id, { role: 'camera' })
      admins.forEach((adminId) => {
        io.to(adminId).emit('camera-joined', { cameraId: socket.id })
      })
    } else {
      console.log('Socket', socket.id, 'joined with unknown role:', role)
    }
  })

  // Offer from camera → admin(s)
  socket.on('webrtc-offer', ({ fromCameraId, sdp }) => {
    if (!fromCameraId || !sdp) return
    console.log('Offer from camera', fromCameraId, 'to admins')
    admins.forEach((adminId) => {
      io.to(adminId).emit('webrtc-offer', { fromCameraId, sdp })
    })
  })

  // Answer from admin → specific camera
  socket.on('webrtc-answer', ({ toCameraId, sdp }) => {
    if (!toCameraId || !sdp) return
    console.log('Answer from admin', socket.id, 'to camera', toCameraId)
    io.to(toCameraId).emit('webrtc-answer', { sdp })
  })

  // ICE candidates (admin ↔ camera)
  socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
    if (!targetId || !candidate) return
    console.log('ICE candidate from', socket.id, 'to', targetId)
    io.to(targetId).emit('webrtc-ice-candidate', { fromId: socket.id, candidate })
  })

  // LIVE STATE from admin → camera
  socket.on('live-state', ({ cameraId, isLive }) => {
    console.log('[SERVER] live-state → camera', cameraId, 'isLive:', isLive)
    if (cameraId) {
      io.to(cameraId).emit('live-state', { cameraId, isLive })
    }
  })

  // RECORD CONTROL from admin → camera
  socket.on('record-control', ({ cameraId, action }) => {
    console.log('[SERVER] record-control → camera', cameraId, 'action:', action)
    if (cameraId && action) {
      io.to(cameraId).emit('record-control', { cameraId, action })
    }
  })

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id)
    if (admins.has(socket.id)) {
      admins.delete(socket.id)
    }
    if (cameras.has(socket.id)) {
      cameras.delete(socket.id)
      admins.forEach((adminId) => {
        io.to(adminId).emit('camera-left', { cameraId: socket.id })
      })
    }
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => {
  console.log(`HTTPS signaling + API server listening on https://localhost:${PORT}`)
})
