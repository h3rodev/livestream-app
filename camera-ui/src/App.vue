<template>
  <div id="cam-root">
    <header>
      <h2>Camera Device</h2>
      <div class="status-row">
        <div class="status">{{ status }}</div>
        <div v-if="isLive" class="live-pill">LIVE</div>
      </div>
    </header>

    <div class="video-box">
      <video
        ref="localVideo"
        playsinline
        webkit-playsinline
        autoplay
        muted
      ></video>
    </div>

    <div class="controls">
      <button @click="startCamera" :disabled="isStreaming">
        Start Camera
      </button>
      <button @click="stopCamera" :disabled="!isStreaming">
        Stop
      </button>
    </div>

    <div class="controls rec-controls" v-if="isStreaming">
      <button
        class="rec-btn"
        :class="{ 'rec-on': isRecording }"
        @click="toggleRecording"
      >
        <span class="rec-dot" :class="{ 'rec-dot-on': isRecording }"></span>
        <span v-if="!isRecording">REC</span>
        <span v-else>STOP</span>
      </button>
      <span class="rec-timer">{{ recordingTimeLabel }}</span>
    </div>

    <div class="debug">
      <div><strong>Camera ID:</strong> {{ cameraId || '—' }}</div>
      <div><strong>Resolution:</strong> {{ resolution }}</div>
      <div><strong>ICE Status:</strong> {{ iceStatus }}</div>
      <div><strong>Recording:</strong> {{ isRecording ? 'ON' : 'OFF' }}</div>
      <div><strong>Last upload:</strong> {{ lastUploadStatus }}</div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client'

export default {
  name: 'CameraApp',

  data() {
    return {
      status: 'Idle',
      cameraId: null,
      iceStatus: 'waiting…',
      resolution: '---',

      socket: null,
      pc: null,
      stream: null,
      isStreaming: false,

      // Recording
      isRecording: false,
      recorder: null,
      recordChunks: [],
      recordStartedAt: null,
      recordTimerId: null,
      recordElapsedSeconds: 0,

      lastUploadStatus: '—',

      // Live indicator (from admin/scene)
      isLive: false,
    }
  },

  computed: {
    recordingTimeLabel() {
      const sec = this.recordElapsedSeconds || 0
      const h = String(Math.floor(sec / 3600)).padStart(2, '0')
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
      const s = String(sec % 60).padStart(2, '0')
      return `${h}:${m}:${s}`
    },
  },

  mounted() {
    this.initSocket()
  },

  methods: {
    initSocket() {
      const signalingUrl = `${window.location.protocol}//${window.location.hostname}:3000`
      console.log('[CAMERA] Connecting to signaling:', signalingUrl)

      this.socket = io(signalingUrl, {
        transports: ['websocket'],
      })

      this.socket.on('connect', () => {
        this.cameraId = this.socket.id
        this.status = 'Connected to signaling server'
        this.socket.emit('join', { role: 'camera' })
      })

      this.socket.on('webrtc-answer', async ({ sdp }) => {
        if (!this.pc) return
        try {
          await this.pc.setRemoteDescription(sdp)
        } catch (err) {
          console.error('[CAMERA] Error setting remote description:', err)
        }
      })

      this.socket.on('webrtc-ice-candidate', async (payload) => {
        if (!this.pc) return
        const candidate = payload?.candidate || payload
        if (!candidate) return
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('[CAMERA] Error adding ICE candidate from admin:', err)
        }
      })

      // --- Remote record control from Admin ---
      this.socket.on('record-control', ({ cameraId, action }) => {
        if (!this.cameraId || cameraId !== this.cameraId) return
        if (action === 'start') {
          if (!this.isRecording) this.startRecording()
        } else if (action === 'stop') {
          if (this.isRecording) this.stopRecording()
        }
      })

      // --- Live state from Admin/Scenes ---
      this.socket.on('live-state', ({ cameraId, isLive }) => {
        if (!this.cameraId || cameraId !== this.cameraId) return
        this.isLive = !!isLive
      })
    },

    async startCamera() {
      try {
        this.status = 'Requesting camera…'

        this.stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        })

        const videoEl = this.$refs.localVideo
        videoEl.srcObject = this.stream

        const vTrack = this.stream.getVideoTracks()[0]
        if (vTrack) {
          const settings = vTrack.getSettings()
          if (settings.width && settings.height) {
            this.resolution = `${settings.width}x${settings.height}`
          }
        }

        this.status = 'Streaming…'
        this.isStreaming = true

        await this.startWebRTC()
      } catch (err) {
        console.error('[CAMERA] Camera error', err)
        this.status = 'Camera permission error'
      }
    },

    async startWebRTC() {
      this.pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.socket.emit('webrtc-ice-candidate', {
            targetId: 'admin',
            candidate: event.candidate,
          })
        }
      }

      this.pc.oniceconnectionstatechange = () => {
        this.iceStatus = this.pc.iceConnectionState
        console.log('[CAMERA] ICE state:', this.iceStatus)
      }

      this.stream.getTracks().forEach((t) => {
        this.pc.addTrack(t, this.stream)
      })

      const offer = await this.pc.createOffer()
      await this.pc.setLocalDescription(offer)

      this.socket.emit('webrtc-offer', {
        fromCameraId: this.socket.id,
        sdp: offer,
      })
    },

    stopCamera() {
      if (this.isRecording) {
        this.stopRecording()
      }

      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop())
      }
      if (this.pc) {
        try {
          this.pc.close()
        } catch (e) {}
      }

      this.stream = null
      this.pc = null
      this.isStreaming = false
      this.status = 'Stopped'
      this.iceStatus = 'waiting…'
      this.resolution = '---'
      this.isLive = false

      const videoEl = this.$refs.localVideo
      if (videoEl && videoEl.srcObject) {
        videoEl.srcObject = null
      }
    },

    // --- Recording ---

    toggleRecording() {
      if (!this.stream) return
      if (this.isRecording) {
        this.stopRecording()
      } else {
        this.startRecording()
      }
    },

    startRecording() {
      if (!this.stream) {
        console.warn('[REC] No stream available for recording')
        return
      }

      let options = undefined
      try {
        if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
          options = { mimeType: 'video/webm;codecs=vp8,opus' }
        } else if (MediaRecorder.isTypeSupported('video/webm')) {
          options = { mimeType: 'video/webm' }
        }
      } catch (e) {
        console.warn(
          '[REC] MediaRecorder.isTypeSupported check failed, using default',
          e,
        )
      }

      try {
        this.recorder = options
          ? new MediaRecorder(this.stream, options)
          : new MediaRecorder(this.stream)
      } catch (e) {
        console.error('[REC] Failed to create MediaRecorder', e)
        return
      }

      this.recordChunks = []
      this.recordStartedAt = new Date()
      this.recordElapsedSeconds = 0
      this.lastUploadStatus = 'recording…'
      this.isRecording = true
      this.emitRecordState() // notify admins immediately

      this.recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          this.recordChunks.push(evt.data)
        }
      }

      this.recorder.onerror = (evt) => {
        console.error('[REC] MediaRecorder error:', evt.error || evt)
      }

      this.recorder.onstop = async () => {
        const endedAt = new Date()
        const startedAt = this.recordStartedAt
        const durationSeconds = this.recordElapsedSeconds

        if (this.recordTimerId) {
          clearInterval(this.recordTimerId)
          this.recordTimerId = null
        }

        if (!this.recordChunks.length) {
          console.warn('[REC] No data chunks recorded')
          this.lastUploadStatus = 'no data'
        } else {
          const mimeType = this.recorder.mimeType || 'video/webm'
          const blob = new Blob(this.recordChunks, { type: mimeType })

          const baseName = this.makeRecordingBaseName(startedAt)

          // Local download
          this.downloadBlob(blob, `${baseName}.webm`)

          const meta = {
            cameraId: this.cameraId,
            startedAt: startedAt.toISOString(),
            endedAt: endedAt.toISOString(),
            durationSeconds,
          }
          const metaBlob = new Blob([JSON.stringify(meta, null, 2)], {
            type: 'application/json',
          })
          this.downloadBlob(metaBlob, `${baseName}.json`)

          // Upload to server
          try {
            await this.uploadRecordingToServer(blob, meta, `${baseName}.webm`)
            this.lastUploadStatus = 'uploaded ✅'
          } catch (err) {
            console.error('[UPLOAD] Failed to upload recording', err)
            this.lastUploadStatus = 'upload failed ❌'
          }
        }

        this.isRecording = false
        this.emitRecordState() // final state to admins
      }

      this.recordTimerId = setInterval(() => {
        this.recordElapsedSeconds += 1
        this.emitRecordState()
      }, 1000)

      try {
        this.recorder.start()
        console.log('[REC] Started recording on camera, mime:', this.recorder.mimeType)
      } catch (e) {
        console.error('[REC] recorder.start failed', e)
      }
    },

    stopRecording() {
      if (!this.recorder || !this.isRecording) return

      try {
        this.recorder.stop()
      } catch (e) {
        console.error('[REC] recorder.stop failed', e)
      }

      if (this.recordTimerId) {
        clearInterval(this.recordTimerId)
        this.recordTimerId = null
      }
      // onstop handler will flip isRecording=false and emit state
    },

    emitRecordState() {
      if (!this.socket || !this.cameraId) return
      this.socket.emit('record-state', {
        cameraId: this.cameraId,
        isRecording: this.isRecording,
        elapsedSeconds: this.recordElapsedSeconds,
      })
    },

    makeRecordingBaseName(dateObj) {
      const safeId =
        (this.cameraId || 'camera').replace(/[^a-zA-Z0-9_-]/g, '')
      const iso = dateObj.toISOString().replace(/[:.]/g, '-')
      return `cam-${safeId}-${iso}`
    },

    downloadBlob(blob, filename) {
      if (!blob || !blob.size) {
        console.warn('[REC] Tried to download empty blob for', filename)
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    },

    async uploadRecordingToServer(blob, meta, filename) {
      const proto = window.location.protocol
      const host = window.location.hostname
      const port = 3000

      const params = new URLSearchParams({
        cameraId: meta.cameraId || '',
        startedAt: meta.startedAt || '',
        endedAt: meta.endedAt || '',
        durationSeconds: String(meta.durationSeconds ?? ''),
        filename: filename || 'recording.webm',
      })

      const uploadUrl = `${proto}//${host}:${port}/api/upload-recording?${params.toString()}`

      console.log('[UPLOAD] Uploading to', uploadUrl)

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: blob,
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`Upload failed: ${response.status} ${text}`)
      }

      const json = await response.json().catch(() => null)
      console.log('[UPLOAD] Server response:', json)
      return json
    },
  },
}
</script>

<style>
:root { color-scheme: dark; }

#cam-root {
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  color: #e5e7eb;
  background: #0b0f14;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

header {
  text-align: center;
}
header h2 {
  margin: 0;
  font-size: 20px;
}

.status-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.status {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
}

.live-pill {
  margin-top: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #ef4444;
  color: #fee2e2;
  background: rgba(239, 68, 68, 0.2);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.video-box {
  width: 100%;
  aspect-ratio: 9 / 16;
  max-width: 500px;
  margin: 0 auto;
  background: #000;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

button {
  background: #1d4ed8;
  border: none;
  padding: 10px 18px;
  border-radius: 999px;
  color: #fff;
  font-size: 14px;
}
button:disabled {
  background: #404040;
}

.rec-controls {
  margin-top: -6px;
}

.rec-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid #ef4444;
  background: #111827;
  color: #ef4444;
  font-size: 13px;
}
.rec-btn.rec-on {
  background: #7f1d1d;
  color: #fee2e2;
}

.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #ef4444;
  opacity: 0.4;
}
.rec-dot-on {
  opacity: 1;
}

.rec-timer {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  color: #e5e7eb;
  align-self: center;
}

.debug {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
  text-align: center;
  line-height: 1.4;
}

@media (orientation: landscape) and (max-height: 500px) {
  #cam-root {
    flex-direction: row;
    align-items: center;
  }
  .video-box {
    flex: 1;
    aspect-ratio: 16 / 9;
    max-width: none;
  }
  .controls,
  .debug,
  header {
    flex: 0 0 220px;
  }
}
</style>
