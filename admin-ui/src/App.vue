<template>
  <div id="app-root">
    <header>
      <h1>Livestream Admin</h1>
      <div id="status">{{ status }}</div>
    </header>

    <div id="camera-summary">{{ cameraSummary }}</div>

    <div id="layout">
      <!-- Preview pane -->
      <div id="preview-pane">
        <div class="pane-header">
          <div class="pane-title">Preview</div>
          <div class="pane-meta">{{ previewMeta }}</div>
        </div>
        <div class="pane-video-wrapper">
          <video
            id="previewVideo"
            ref="previewVideo"
            controls
            playsinline
            webkit-playsinline
          ></video>
        </div>
      </div>

      <!-- Live pane -->
      <div id="live-pane">
        <div class="pane-header">
          <div class="pane-title">Live</div>
          <div class="pane-meta">{{ liveMeta }}</div>
        </div>
        <div class="pane-video-wrapper">
          <video
            id="liveVideo"
            ref="liveVideo"
            controls
            playsinline
            webkit-playsinline
          ></video>
        </div>
      </div>

      <!-- TAKE button bar -->
      <div id="take-bar">
        <button
          id="take-button"
          :disabled="!takeEnabled"
          @click="setLiveFromPreview"
        >
          TAKE PREVIEW TO LIVE
        </button>
      </div>

      <!-- Bottom strip: audio + 5 camera slots -->
      <div id="bottom-strip">
        <div id="audio-panel">
          <div id="audio-panel-header">
            <span class="camera-label">Audio</span>
            <span style="font-size:10px;color:#4b5563;">(coming soon)</span>
          </div>
          <div id="audio-panel-body">
            Audio meters &amp; routing here
          </div>
        </div>

        <!-- Camera slots V1–V5 -->
        <div
          class="camera-slot"
          v-for="(slot, index) in cameraSlots"
          :key="index"
        >
          <div class="camera-slot-header">
            <span class="camera-label">{{ slot.label }}</span>
            <span
              class="camera-status"
              :class="slot.statusClass"
            >{{ slot.statusText }}</span>
          </div>
          <div
            class="camera-thumb-wrapper"
            :class="{
              'active-preview': slot.cameraId === currentPreviewId,
              'active-live': slot.cameraId === currentLiveId
            }"
            @click="slot.cameraId && setPreviewCamera(slot.cameraId)"
          >
            <video
              muted
              playsinline
              webkit-playsinline
              :ref="'thumbVideo-' + index"
            ></video>
            <div class="camera-thumb-overlay"></div>
          </div>
          <div class="camera-id-text">
            {{ slot.cameraId || '—' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { io } from 'socket.io-client'

export default {
  name: 'App',

  data() {
    return {
      status: 'Connecting…',
      cameraSummary: 'No cameras connected.',
      previewMeta: 'None selected',
      liveMeta: 'None on air',

      cameraSlots: [
        { label: 'V1', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V2', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V3', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V4', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V5', cameraId: null, statusText: 'offline', statusClass: 'status-offline' }
      ],

      cameras: {},          // cameraId -> { pc, stream, slotIndex }
      currentPreviewId: null,
      currentLiveId: null,
      socket: null,
    }
  },

  computed: {
    takeEnabled() {
      return !!this.currentPreviewId
    },
  },

  mounted() {
    this.initSocket()
  },

  methods: {
    logStatus(msg) {
      console.log(msg)
      this.status = msg
    },

    updateCameraSummary() {
      const count = Object.keys(this.cameras).length
      this.cameraSummary = count === 0
        ? 'No cameras connected.'
        : `Cameras connected: ${count}`
    },

    assignSlotForCamera(cameraId) {
      const existingIndex = this.cameraSlots.findIndex(
        s => s.cameraId === cameraId,
      )
      if (existingIndex !== -1) return existingIndex

      const freeIndex = this.cameraSlots.findIndex(s => !s.cameraId)
      if (freeIndex !== -1) {
        this.cameraSlots[freeIndex].cameraId = cameraId
        return freeIndex
      }

      return this.cameraSlots.length - 1
    },

    setSlotState(slotIndex, text, className) {
      const slot = this.cameraSlots[slotIndex]
      if (!slot) return
      slot.statusText = text
      slot.statusClass = className
    },

    getThumbVideo(slotIndex) {
      const refName = 'thumbVideo-' + slotIndex
      const ref = this.$refs[refName]
      if (!ref) return null
      return Array.isArray(ref) ? ref[0] : ref
    },

    setPreviewCamera(cameraId) {
      const info = this.cameras[cameraId]
      if (!info || !info.stream) return

      this.currentPreviewId = cameraId
      const previewVideo = this.$refs.previewVideo
      previewVideo.srcObject = info.stream
      this.previewMeta = `Previewing ${cameraId}`
    },

    setLiveFromPreview() {
      if (!this.currentPreviewId) return
      const info = this.cameras[this.currentPreviewId]
      if (!info || !info.stream) return

      this.currentLiveId = this.currentPreviewId
      const liveVideo = this.$refs.liveVideo
      liveVideo.srcObject = info.stream
      this.liveMeta = `On Air: ${this.currentLiveId}`
    },

    initSocket() {
      const signalingUrl = `${window.location.protocol}//${window.location.hostname}:3000`
      console.log('[ADMIN] Connecting to signaling:', signalingUrl)

      this.socket = io(signalingUrl, {
        transports: ['websocket'],
      })

      this.socket.on('connect', () => {
        this.logStatus('Connected. Joining as admin…')
        this.socket.emit('join', { role: 'admin' })
      })

      this.socket.on('camera-joined', ({ cameraId }) => {
        console.log('[ADMIN] Camera joined:', cameraId)
        if (!this.cameras[cameraId]) {
          const slotIndex = this.assignSlotForCamera(cameraId)
          this.setSlotState(slotIndex, 'connecting', 'status-connecting')
          this.cameras[cameraId] = { pc: null, stream: null, slotIndex }
        }
        this.updateCameraSummary()
      })

      this.socket.on('camera-left', ({ cameraId }) => {
        console.log('[ADMIN] Camera left:', cameraId)
        const info = this.cameras[cameraId]
        if (info) {
          if (info.pc) {
            try { info.pc.close() } catch (e) {}
          }
          const thumbVideo = this.getThumbVideo(info.slotIndex)
          if (thumbVideo && thumbVideo.srcObject) {
            thumbVideo.srcObject.getTracks().forEach(t => t.stop())
            thumbVideo.srcObject = null
          }
          this.setSlotState(info.slotIndex, 'offline', 'status-offline')

          if (this.currentPreviewId === cameraId) {
            this.currentPreviewId = null
            this.$refs.previewVideo.srcObject = null
            this.previewMeta = 'None selected'
          }
          if (this.currentLiveId === cameraId) {
            this.currentLiveId = null
            this.$refs.liveVideo.srcObject = null
            this.liveMeta = 'None on air'
          }

          delete this.cameras[cameraId]
          this.updateCameraSummary()
        }
      })

      this.socket.on('webrtc-offer', async ({ fromCameraId, sdp }) => {
        this.logStatus(`Received offer from camera ${fromCameraId}`)
        console.log('[ADMIN] webrtc-offer from', fromCameraId, sdp)

        let info = this.cameras[fromCameraId]
        if (!info) {
          const slotIndex = this.assignSlotForCamera(fromCameraId)
          info = { pc: null, stream: null, slotIndex }
          this.cameras[fromCameraId] = info
        }

        if (info.pc) {
          try { info.pc.close() } catch (e) {}
        }

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        })
        info.pc = pc
        this.setSlotState(info.slotIndex, 'connecting', 'status-connecting')

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            this.socket.emit('webrtc-ice-candidate', {
              targetId: fromCameraId,
              candidate: event.candidate,
            })
          }
        }

        pc.onconnectionstatechange = () => {
          console.log('[ADMIN] PC state for', fromCameraId, '=', pc.connectionState)
          if (pc.connectionState === 'connected') {
            this.setSlotState(info.slotIndex, 'live', 'status-live')
            this.logStatus('Connected to one or more cameras.')
          } else if (
            pc.connectionState === 'disconnected' ||
            pc.connectionState === 'failed'
          ) {
            this.setSlotState(info.slotIndex, 'offline', 'status-offline')
          }
        }

        pc.ontrack = (event) => {
          console.log('[ADMIN] Remote track from', fromCameraId, event.streams, event.track)
          let stream = event.streams && event.streams[0]

          if (!stream) {
            if (info.stream instanceof MediaStream) {
              stream = info.stream
            } else {
              stream = new MediaStream()
            }
            stream.addTrack(event.track)
          }

          info.stream = stream

          const thumbVideo = this.getThumbVideo(info.slotIndex)
          if (thumbVideo && thumbVideo.srcObject !== stream) {
            thumbVideo.srcObject = stream
          }

          if (!this.currentPreviewId) {
            this.setPreviewCamera(fromCameraId)
          }
          if (!this.currentLiveId) {
            this.setLiveFromPreview()
          }
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          this.socket.emit('webrtc-answer', {
            toCameraId: fromCameraId,
            sdp: pc.localDescription,
          })
          this.logStatus(`Sent answer to camera ${fromCameraId}`)
        } catch (err) {
          console.error('[ADMIN] Error handling offer for', fromCameraId, err)
          this.setSlotState(info.slotIndex, 'offline', 'status-offline')
          this.logStatus('Error handling offer. See console.')
        }

        this.updateCameraSummary()
      })

      this.socket.on('webrtc-ice-candidate', async ({ fromId, candidate }) => {
        const info = this.cameras[fromId]
        if (!info || !info.pc || !candidate) return
        try {
          await info.pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (err) {
          console.error('[ADMIN] Error adding ICE candidate from', fromId, err)
        }
      })
    },
  },
}
</script>

<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }

#app-root {
  margin: 0;
  padding: 12px;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
  background: #070b10;
  color: #e5e7eb;
  min-height: 100vh;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
header h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}
#status {
  font-size: 12px;
  color: #9ca3af;
}

#camera-summary {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 8px;
}

#layout {
  display: grid;
  grid-template-rows: minmax(260px, 1fr) auto;
  grid-template-columns: 1.1fr 1.9fr;
  gap: 4px;
  height: calc(100vh - 80px);
}

#preview-pane,
#live-pane {
  background: #0b1120;
  border: 1px solid #1f2937;
  border-radius: 6px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pane-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #9ca3af;
}

.pane-title {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 11px;
}

.pane-meta {
  font-size: 11px;
  color: #6b7280;
}

.pane-video-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #020617;
  border-radius: 4px;
  overflow: hidden;
}

video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

#take-bar {
  grid-column: 1 / span 2;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 4px 0;
}

#take-button {
  padding: 6px 16px;
  border-radius: 999px;
  border: 1px solid #f97316;
  background: #0f172a;
  color: #f97316;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  cursor: pointer;
}
#take-button:disabled {
  opacity: 0.4;
  cursor: default;
}

#bottom-strip {
  grid-column: 1 / span 2;
  display: grid;
  grid-template-columns: 0.9fr repeat(5, 1fr);
  gap: 4px;
  margin-top: 4px;
}

#audio-panel,
.camera-slot {
  background: #020617;
  border: 1px solid #1f2937;
  border-radius: 6px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

#audio-panel-header,
.camera-slot-header {
  font-size: 11px;
  color: #9ca3af;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

#audio-panel-body {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #4b5563;
}

.camera-label {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.camera-status {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
}
.status-offline {
  border-color: #4b5563;
  color: #9ca3af;
  background: rgba(75, 85, 99, 0.3);
}
.status-connecting {
  border-color: #f97316;
  color: #f97316;
  background: rgba(249, 115, 22, 0.12);
}
.status-live {
  border-color: #22c55e;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.18);
}
.status-previewing {
  border-color: #38bdf8;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.18);
}

.camera-thumb-wrapper {
  flex: 1;
  position: relative;
  background: #020617;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.camera-thumb-wrapper video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.camera-thumb-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 1px solid transparent;
}
.camera-thumb-wrapper.active-preview .camera-thumb-overlay {
  border-color: #38bdf8;
}
.camera-thumb-wrapper.active-live .camera-thumb-overlay {
  border-color: #22c55e;
}

.camera-id-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 10px;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-top: 2px;
}
</style>
