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
            autoplay
            muted
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
            autoplay
            muted
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
        <!-- AUDIO MIXER PANEL -->
        <div id="audio-panel">
          <div id="audio-panel-header">
            <span class="camera-label">Audio Mixer</span>
            <span style="font-size:10px;color:#4b5563;">
              {{ audioStatusLabel }}
            </span>
          </div>

          <div id="audio-panel-body">
            <div v-if="!audioReady" class="audio-disabled">
              <button @click="enableAudioMixer">
                Enable Mixer
              </button>
              <div class="audio-hint">
                Required once per session so the browser allows audio.
              </div>
            </div>

            <div v-else class="audio-mixer">
              <div class="audio-master">
                <div class="audio-row-label">
                  Master
                  <span class="audio-value">{{ Math.round(masterVolume * 100) }}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  v-model.number="masterVolumeSlider"
                  @input="onMasterVolumeChange"
                />
              </div>

              <div class="audio-sources">
                <div
                  v-if="audioSources.length === 0"
                  class="audio-no-sources"
                >
                  No camera audio sources yet.
                </div>

                <div
                  v-for="src in audioSources"
                  :key="src.cameraId"
                  class="audio-source-row"
                >
                  <div class="audio-row-label">
                    {{ src.label }}
                    <span class="audio-value">
                      {{ Math.round((src.volume ?? 1) * 100) }}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    :value="(src.volume ?? 1) * 100"
                    @input="onCameraVolumeInput(src.cameraId, $event)"
                  />
                </div>
              </div>
            </div>
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
              :class="[
                slot.statusClass,
                isRecording(slot.cameraId) ? 'status-recording' : ''
              ]"
            >
              {{ slot.statusText }}
            </span>
          </div>

          <div
            class="camera-thumb-wrapper"
            :class="{
              'active-preview': slot.cameraId === currentPreviewId,
              'active-live': slot.cameraId === currentLiveId,
              'recording-border': isRecording(slot.cameraId)
            }"
            @click="slot.cameraId && setPreviewCamera(slot.cameraId)"
          >
            <video
              muted
              autoplay
              playsinline
              webkit-playsinline
              :ref="'thumbVideo-' + index"
            ></video>
            <div class="camera-thumb-overlay"></div>
          </div>

          <!-- Recording controls per camera -->
          <div
            v-if="slot.cameraId"
            class="camera-rec-row"
          >
            <button
              class="rec-button"
              :class="{ 'rec-on': isRecording(slot.cameraId) }"
              @click.stop="toggleRecording(slot.cameraId)"
            >
              <span class="rec-dot" :class="{ 'rec-dot-on': isRecording(slot.cameraId) }"></span>
              <span v-if="!isRecording(slot.cameraId)">REC</span>
              <span v-else>STOP</span>
            </button>
            <span class="rec-timer">
              {{ recordingTimeLabel(slot.cameraId) }}
            </span>
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

      cameras: {},          // cameraId -> { pc, stream, slotIndex, audioVolume }
      currentPreviewId: null,
      currentLiveId: null,
      socket: null,

      // Audio mixer
      audioContext: null,
      masterGain: null,
      audioNodes: {},       // cameraId -> { sourceNode, gainNode }
      audioReady: false,
      masterVolume: 1.0,
      masterVolumeSlider: 100,

      // Recording state
      recordings: {},       // cameraId -> { isRecording, startedAt, elapsedSeconds, chunks, recorder, timerId }
    }
  },

  computed: {
    takeEnabled() {
      return !!this.currentPreviewId
    },

    audioSources() {
      return Object.keys(this.cameras)
        .filter(id => this.audioNodes[id])
        .map(id => ({
          cameraId: id,
          label: `Cam ${id.slice(0, 4)}`,
          volume: this.cameras[id]?.audioVolume ?? 1,
        }))
    },

    audioStatusLabel() {
      if (!this.audioReady) return 'disabled'
      if (this.audioSources.length === 0) return 'no active audio'
      return 'live'
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

      // Visually mark which slot is preview
      this.cameraSlots.forEach((slot) => {
        if (!slot.cameraId) return
        if (slot.cameraId === this.currentLiveId) {
          // Keep live slot as LIVE
          slot.statusText = 'LIVE'
          slot.statusClass = 'status-live'
        } else if (slot.cameraId === this.currentPreviewId) {
          // Preview but not live yet: show as online
          if (slot.statusText === 'offline') {
            slot.statusText = 'online'
            slot.statusClass = 'status-online'
          }
        }
      })
    },

    setLiveFromPreview() {
      if (!this.currentPreviewId) return
      const info = this.cameras[this.currentPreviewId]
      if (!info || !info.stream) return

      const previousLiveId = this.currentLiveId

      this.currentLiveId = this.currentPreviewId
      const liveVideo = this.$refs.liveVideo
      liveVideo.srcObject = info.stream
      this.liveMeta = `On Air: ${this.currentLiveId}`

      // Update slot statuses: exactly one LIVE, others online/offline
      this.cameraSlots.forEach((slot) => {
        if (!slot.cameraId) {
          slot.statusText = 'offline'
          slot.statusClass = 'status-offline'
          return
        }
        if (slot.cameraId === this.currentLiveId) {
          slot.statusText = 'LIVE'
          slot.statusClass = 'status-live'
        } else {
          // Connected but not live
          slot.statusText = 'online'
          slot.statusClass = 'status-online'
        }
      })

      // Tell cameras which one is LIVE
      if (this.socket && this.currentLiveId) {
        this.socket.emit('live-state', {
          cameraId: this.currentLiveId,
          isLive: true,
        })
      }
      if (this.socket && previousLiveId && previousLiveId !== this.currentLiveId) {
        this.socket.emit('live-state', {
          cameraId: previousLiveId,
          isLive: false,
        })
      }
    },

    // --- AUDIO MIXER LOGIC ---

    enableAudioMixer() {
      if (!this.audioContext) {
        const AC = window.AudioContext || window.webkitAudioContext
        this.audioContext = new AC()
        this.masterGain = this.audioContext.createGain()
        this.masterGain.gain.value = this.masterVolume
        this.masterGain.connect(this.audioContext.destination)
      } else if (this.audioContext.state === 'suspended') {
        this.audioContext.resume()
      }
      this.audioReady = true
    },

    ensureCameraAudio(cameraId, stream) {
      if (!this.audioReady || !this.audioContext || !this.masterGain) return
      if (this.audioNodes[cameraId]) return

      const audioTracks = stream.getAudioTracks()
      if (!audioTracks || audioTracks.length === 0) return

      const audioStream = new MediaStream(audioTracks)
      const source = this.audioContext.createMediaStreamSource(audioStream)
      const gainNode = this.audioContext.createGain()
      gainNode.gain.value = this.cameras[cameraId]?.audioVolume ?? 1.0

      source.connect(gainNode).connect(this.masterGain)

      this.audioNodes[cameraId] = { sourceNode: source, gainNode }
      if (!this.cameras[cameraId].audioVolume) {
        this.cameras[cameraId].audioVolume = 1.0
      }
    },

    teardownCameraAudio(cameraId) {
      const node = this.audioNodes[cameraId]
      if (!node) return

      try {
        node.sourceNode.disconnect()
      } catch {}
      try {
        node.gainNode.disconnect()
      } catch {}

      delete this.audioNodes[cameraId]
    },

    onMasterVolumeChange() {
      this.masterVolume = this.masterVolumeSlider / 100
      if (this.masterGain) {
        this.masterGain.gain.value = this.masterVolume
      }
    },

    onCameraVolumeInput(cameraId, event) {
      const value = Number(event.target.value)
      const normalized = value / 100
      const info = this.cameras[cameraId]
      if (!info) return
      info.audioVolume = normalized

      const node = this.audioNodes[cameraId]
      if (node && node.gainNode) {
        node.gainNode.gain.value = normalized
      }
    },

    // --- RECORDING LOGIC ---

    isRecording(cameraId) {
      if (!cameraId) return false
      return !!(this.recordings[cameraId] && this.recordings[cameraId].isRecording)
    },

    recordingTimeLabel(cameraId) {
      const rec = this.recordings[cameraId]
      const sec = rec && rec.elapsedSeconds ? rec.elapsedSeconds : 0
      const h = String(Math.floor(sec / 3600)).padStart(2, '0')
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
      const s = String(sec % 60).padStart(2, '0')
      return `${h}:${m}:${s}`
    },

    toggleRecording(cameraId) {
      if (!cameraId) return

      const wasRecording = this.isRecording(cameraId)

      if (wasRecording) {
        this.stopRecording(cameraId)
        if (this.socket) {
          this.socket.emit('record-control', {
            cameraId,
            action: 'stop',
          })
        }
      } else {
        this.startRecording(cameraId)
        if (this.socket) {
          this.socket.emit('record-control', {
            cameraId,
            action: 'start',
          })
        }
      }
    },

    startRecording(cameraId) {
      const info = this.cameras[cameraId]
      if (!info || !info.stream) {
        console.warn('[REC] No stream for camera', cameraId)
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
        console.warn('[REC] MediaRecorder.isTypeSupported check failed, using default', e)
      }

      let recorder
      try {
        recorder = options
          ? new MediaRecorder(info.stream, options)
          : new MediaRecorder(info.stream)
      } catch (e) {
        console.error('[REC] Failed to create MediaRecorder', e)
        return
      }

      const recState = {
        isRecording: true,
        startedAt: new Date(),
        elapsedSeconds: 0,
        chunks: [],
        recorder,
        timerId: null,
      }

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          recState.chunks.push(evt.data)
        }
      }

      recorder.onerror = (evt) => {
        console.error('[REC] MediaRecorder error:', evt.error || evt)
      }

      recorder.onstop = () => {
        const endedAt = new Date()
        const startedAt = recState.startedAt
        const durationSeconds = recState.elapsedSeconds

        if (recState.timerId) {
          clearInterval(recState.timerId)
          recState.timerId = null
        }

        if (!recState.chunks.length) {
          console.warn('[REC] No data chunks recorded for', cameraId)
        } else {
          const mimeType = recorder.mimeType || 'video/webm'
          const blob = new Blob(recState.chunks, { type: mimeType })

          const baseName = this.makeRecordingBaseName(cameraId, startedAt)
          this.downloadBlob(blob, `${baseName}.webm`)
        }

        const meta = {
          cameraId,
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
          durationSeconds,
        }
        const metaBlob = new Blob([JSON.stringify(meta, null, 2)], {
          type: 'application/json',
        })
        const baseName = this.makeRecordingBaseName(cameraId, startedAt)
        this.downloadBlob(metaBlob, `${baseName}.json`)

        recState.isRecording = false
      }

      recState.timerId = setInterval(() => {
        recState.elapsedSeconds += 1
      }, 1000)

      this.recordings[cameraId] = recState

      try {
        recorder.start()
      } catch (e) {
        console.error('[REC] recorder.start failed', e)
      }
    },

    stopRecording(cameraId) {
      const rec = this.recordings[cameraId]
      if (!rec || !rec.isRecording || !rec.recorder) return

      try {
        rec.recorder.stop()
      } catch (e) {
        console.error('[REC] recorder.stop failed', e)
      }

      rec.isRecording = false
      if (rec.timerId) {
        clearInterval(rec.timerId)
        rec.timerId = null
      }
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

    makeRecordingBaseName(cameraId, dateObj) {
      const safeId = cameraId.replace(/[^a-zA-Z0-9_-]/g, '')
      const iso = dateObj.toISOString().replace(/[:.]/g, '-')
      return `cam-${safeId}-${iso}`
    },

    // --- SOCKET / WEBRTC ---

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
          this.cameras[cameraId] = { pc: null, stream: null, slotIndex, audioVolume: 1.0 }
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

          if (this.isRecording(cameraId)) {
            this.stopRecording(cameraId)
          }

          this.teardownCameraAudio(cameraId)
          delete this.cameras[cameraId]
          this.updateCameraSummary()
        }
      })

      this.socket.on('webrtc-offer', async ({ fromCameraId, sdp }) => {
        this.logStatus(`Received offer from camera ${fromCameraId}`)

        let info = this.cameras[fromCameraId]
        if (!info) {
          const slotIndex = this.assignSlotForCamera(fromCameraId)
          info = { pc: null, stream: null, slotIndex, audioVolume: 1.0 }
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
          if (pc.connectionState === 'connected') {
            // Connected but NOT live yet → "online"
            this.setSlotState(info.slotIndex, 'online', 'status-online')
            this.logStatus('Connected to one or more cameras.')
          } else if (
            pc.connectionState === 'disconnected' ||
            pc.connectionState === 'failed'
          ) {
            this.setSlotState(info.slotIndex, 'offline', 'status-offline')
          }
        }

        pc.ontrack = (event) => {
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

          this.ensureCameraAudio(fromCameraId, stream)

          if (!this.currentPreviewId) {
            this.setPreviewCamera(fromCameraId)
          }
          // No auto-live: only TAKE moves to LIVE
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

/* Main layout: 2 columns (Preview | Live) + bottom strip */
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

/* Bottom strip: audio + camera thumbnails */
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

/* AUDIO PANEL BODY */
#audio-panel-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 11px;
}

.audio-disabled {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.audio-disabled button {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid #22c55e;
  background: #0f172a;
  color: #22c55e;
  font-size: 11px;
  cursor: pointer;
}

.audio-hint {
  color: #6b7280;
  font-size: 10px;
}

.audio-mixer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.audio-master {
  border-bottom: 1px solid #1f2937;
  padding-bottom: 6px;
}

.audio-row-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin-bottom: 2px;
}

.audio-value {
  color: #9ca3af;
  font-size: 10px;
}

.audio-master input[type="range"],
.audio-source-row input[type="range"] {
  width: 100%;
}

.audio-sources {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.audio-source-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.audio-no-sources {
  color: #4b5563;
  font-size: 10px;
}

/* CAMERA SLOTS */

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

/* offline */
.status-offline {
  border-color: #4b5563;
  color: #9ca3af;
  background: rgba(75, 85, 99, 0.3);
}

/* connecting */
.status-connecting {
  border-color: #f97316;
  color: #f97316;
  background: rgba(249, 115, 22, 0.12);
}

/* connected but not live */
.status-online {
  border-color: #3b82f6;
  color: #bfdbfe;
  background: rgba(59, 130, 246, 0.16);
}

/* LIVE on air */
.status-live {
  border-color: #22c55e;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.18);
}

/* RECORDING overlay */
.status-recording {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

.camera-thumb-wrapper {
  flex: 1;
  position: relative;
  background: #020617;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
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
.camera-thumb-wrapper.recording-border .camera-thumb-overlay {
  box-shadow: 0 0 0 1px #ef4444, 0 0 12px rgba(239, 68, 68, 0.6);
}

/* Recording controls */
.camera-rec-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 4px;
  font-size: 11px;
}

.rec-button {
  border-radius: 999px;
  border: 1px solid #ef4444;
  background: #111827;
  color: #ef4444;
  padding: 2px 8px;
  font-size: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}
.rec-button.rec-on {
  background: #7f1d1d;
  color: #fee2e2;
}

.rec-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #ef4444;
  opacity: 0.4;
}
.rec-dot-on {
  opacity: 1;
}

.rec-timer {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 10px;
  color: #e5e7eb;
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
