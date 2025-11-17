<template>
  <div id="cam-root">
    <header>
      <h2>Camera Device</h2>
      <div class="status">{{ status }}</div>
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
      <button @click="startCamera" :disabled="isStreaming">Start Camera</button>
      <button @click="stopCamera" :disabled="!isStreaming">Stop</button>
    </div>

    <div class="debug">
      <div><strong>Camera ID:</strong> {{ cameraId || '—' }}</div>
      <div><strong>Resolution:</strong> {{ resolution }}</div>
      <div><strong>ICE Status:</strong> {{ iceStatus }}</div>
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
    }
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

      // Answer from admin: { sdp }
      this.socket.on('webrtc-answer', async ({ sdp }) => {
        if (!this.pc) return
        try {
          await this.pc.setRemoteDescription(sdp)
        } catch (err) {
          console.error('[CAMERA] Error setting remote description:', err)
        }
      })

      // ICE from admin: { fromId?, candidate }
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

      const videoEl = this.$refs.localVideo
      if (videoEl && videoEl.srcObject) {
        videoEl.srcObject = null
      }
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
.status {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 4px;
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
