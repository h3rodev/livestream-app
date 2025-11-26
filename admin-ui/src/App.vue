<template>
  <div id="app-root">
    <header>
      <h1>Livestream Admin</h1>
      <div id="status">{{ status }}</div>
    </header>

    <div id="camera-summary">{{ cameraSummary }}</div>

    <div id="layout">
      <!-- PREVIEW PANE (Scene Editor) -->
      <div id="preview-pane">
        <div class="pane-header">
          <div class="pane-title">Preview</div>
          <div class="pane-meta">{{ previewMeta }}</div>
        </div>

        <!-- Scene controls -->
        <div class="scene-panel">
          <div class="scene-list">
            <span class="scene-label">Scenes</span>

            <button
              v-for="scene in scenes"
              :key="scene.id"
              class="scene-btn"
              :class="{ 'scene-btn-active': scene.id === activeSceneId }"
              @click="selectScene(scene.id)"
            >
              <span class="scene-btn-name">{{ scene.name }}</span>
              <span class="scene-btn-summary">
                {{ sceneSummary(scene) }}
              </span>
            </button>

            <button class="scene-btn scene-btn-add" @click="addScene">
              + New
            </button>
          </div>

          <div class="scene-tools">
            <span class="scene-tools-label">Add source:</span>
            <button
              v-for="slot in cameraSlots"
              :key="slot.label"
              class="scene-source-btn"
              :disabled="!slot.cameraId || sceneHasSlot(activeScene, slotIndexFromLabel(slot.label))"
              @click="addSlotToScene(slotIndexFromLabel(slot.label))"
            >
              {{ slot.label }}
            </button>
          </div>
        </div>

        <!-- Scene canvas (Preview) -->
        <div class="pane-video-wrapper aspect-16-9">
          <div class="scene-canvas">
            <div
              v-if="previewSceneItems.length === 0"
              class="scene-empty-hint"
            >
              No sources in this scene yet.<br />
              Use the buttons above to add V1–V5 to the layout.
            </div>

            <div
              v-for="item in previewSceneItems"
              :key="item.id"
              class="scene-item"
              :class="{ 'scene-item-selected': item.id === selectedSceneItemId }"
              :style="sceneItemStyle(item)"
              @mousedown.stop="startDrag(item, $event)"
            >
              <video
                muted
                playsinline
                webkit-playsinline
                autoplay
                :ref="'sceneVideo-' + item.slotIndex"
              ></video>

              <button
                class="scene-item-remove"
                @click.stop="removeSceneItem(item.id)"
              >
                ✕
              </button>

              <div
                class="resize-handle br"
                @mousedown.stop="startResize(item, $event)"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- LIVE PANE -->
      <div id="live-pane">
        <div class="pane-header">
          <div class="pane-title">Live</div>
          <div class="pane-meta">{{ liveMeta }}</div>
        </div>

        <div class="pane-video-wrapper aspect-16-9">
          <div class="scene-canvas">
            <div
              v-if="liveSceneItems.length === 0"
              class="scene-empty-hint"
            >
              No scene on air.<br />
              Select a scene on the left and press TAKE.
            </div>

            <div
              v-for="item in liveSceneItems"
              :key="item.id"
              class="scene-item"
              :style="sceneItemStyle(item)"
            >
              <video
                muted
                playsinline
                webkit-playsinline
                autoplay
                :ref="'liveSceneVideo-' + item.slotIndex"
              ></video>
            </div>
          </div>
        </div>
      </div>

      <!-- TAKE button bar -->
      <div id="take-bar">
        <button
          id="take-button"
          :disabled="!takeEnabled"
          @click="setLiveFromPreview"
        >
          TAKE PREVIEW SCENE TO LIVE
        </button>
      </div>

      <!-- PROGRAM RECORDING BAR -->
      <div id="program-rec-bar">
        <div class="program-label">Program Output</div>
        <button
          class="rec-button program-rec-button"
          :class="{ 'rec-on': programRecording.isRecording }"
          @click="toggleProgramRecording"
        >
          <span
            class="rec-dot"
            :class="{ 'rec-dot-on': programRecording.isRecording }"
          ></span>
          <span v-if="!programRecording.isRecording">REC PROGRAM</span>
          <span v-else>STOP PROGRAM</span>
        </button>
        <span class="rec-timer">
          {{ programRecordingTimeLabel }}
        </span>
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
                  <span class="audio-value">
                    {{ Math.round(masterVolume * 100) }}%
                  </span>
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
              'recording-border': isRecording(slot.cameraId)
            }"
            @click="slot.cameraId && handleSlotClick(index)"
          >
            <video
              muted
              playsinline
              webkit-playsinline
              autoplay
              :ref="'thumbVideo-' + index"
            ></video>
            <div class="camera-thumb-overlay"></div>
          </div>

          <div
            v-if="slot.cameraId"
            class="camera-rec-row"
          >
            <button
              class="rec-button"
              :class="{ 'rec-on': isRecording(slot.cameraId) }"
              @click.stop="toggleRecording(slot.cameraId)"
            >
              <span
                class="rec-dot"
                :class="{ 'rec-dot-on': isRecording(slot.cameraId) }"
              ></span>
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

const SCENE_STORAGE_KEY = 'mplapp_scenes_v2'

// Basic Safari detection for MediaRecorder quirks
const isSafari = /^((?!chrome|android).)*safari/i.test(
  typeof navigator !== 'undefined' ? navigator.userAgent : '',
)

export default {
  name: 'App',

  data() {
    return {
      status: 'Connecting…',
      cameraSummary: 'No cameras connected.',
      previewMeta: 'Scene: None selected',
      liveMeta: 'None on air',

      cameraSlots: [
        { label: 'V1', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V2', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V3', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V4', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
        { label: 'V5', cameraId: null, statusText: 'offline', statusClass: 'status-offline' },
      ],

      // cameraId -> { pc, stream, slotIndex, audioVolume, programVideoEl? }
      cameras: {},

      socket: null,

      // Audio mixer
      audioContext: null,
      masterGain: null,
      audioNodes: {},       // cameraId -> { sourceNode, gainNode }
      audioReady: false,
      masterVolume: 1.0,
      masterVolumeSlider: 100,

      // Recording state mirrored from cameras
      // cameraId -> { isRecording, elapsedSeconds }
      recordings: {},

      // Scene system
      scenes: [
        {
          id: 'scene-1',
          name: 'Scene 1',
          items: [],
        },
      ],
      activeSceneId: 'scene-1',
      sceneCounter: 1,
      selectedSceneItemId: null,

      // Live scene snapshot
      liveScene: {
        id: null,
        name: '',
        items: [],
      },

      dragState: null,
      resizeState: null,

      // Program (mixed output) recording
      programRecording: {
        isRecording: false,
        recorder: null,
        chunks: [],
        startedAt: null,
        elapsedSeconds: 0,
        timerId: null,
      },
      programCanvas: null,
      programCtx: null,
      programRenderLoopRunning: false,
    }
  },

  computed: {
    takeEnabled() {
      const scene = this.activeScene
      return !!(scene && scene.items && scene.items.length)
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

    // Program recording timer label
    programRecordingTimeLabel() {
      const sec = this.programRecording.elapsedSeconds || 0
      const h = String(Math.floor(sec / 3600)).padStart(2, '0')
      const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
      const s = String(sec % 60).padStart(2, '0')
      return `${h}:${m}:${s}`
    },

    activeScene() {
      return this.scenes.find(s => s.id === this.activeSceneId) || null
    },

    previewSceneItems() {
      return this.activeScene ? this.activeScene.items : []
    },

    liveSceneItems() {
      return this.liveScene?.items || []
    },
  },

  watch: {
    scenes: {
      handler() {
        this.saveScenesToStorage()
      },
      deep: true,
    },
    activeSceneId() {
      this.saveScenesToStorage()
    },
    liveScene: {
      handler() {
        this.saveScenesToStorage()
      },
      deep: true,
    },
  },

  mounted() {
    this.loadScenesFromStorage()
    this.initSocket()
    this.ensureProgramCanvas()
    this.startProgramRenderLoop()
  },

  methods: {
    /* ---- Storage ---- */
    saveScenesToStorage() {
      try {
        const payload = {
          scenes: this.scenes,
          activeSceneId: this.activeSceneId,
          liveScene: this.liveScene,
          sceneCounter: this.sceneCounter,
        }
        window.localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(payload))
      } catch (e) {
        console.warn('[SCENES] Failed to save scenes', e)
      }
    },

    loadScenesFromStorage() {
      try {
        const raw = window.localStorage.getItem(SCENE_STORAGE_KEY)
        if (!raw) return
        const parsed = JSON.parse(raw)
        if (parsed && Array.isArray(parsed.scenes) && parsed.scenes.length) {
          this.scenes = parsed.scenes
          this.activeSceneId = parsed.activeSceneId || parsed.scenes[0].id
          this.liveScene = parsed.liveScene || { id: null, name: '', items: [] }
          this.sceneCounter = parsed.sceneCounter || parsed.scenes.length
          const active = this.activeScene
          this.previewMeta = active
            ? `Scene: ${active.name}`
            : 'Scene: None selected'
          this.liveMeta = this.liveScene && this.liveScene.id
            ? `On Air: ${this.liveScene.name}`
            : 'None on air'
        }
      } catch (e) {
        console.warn('[SCENES] Failed to load scenes', e)
      }
    },

    /* ---- Utility ---- */
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

    slotIndexFromLabel(label) {
      return this.cameraSlots.findIndex(s => s.label === label)
    },

    getThumbVideo(slotIndex) {
      const refName = 'thumbVideo-' + slotIndex
      const ref = this.$refs[refName]
      if (!ref) return null
      return Array.isArray(ref) ? ref[0] : ref
    },

    setSlotState(slotIndex, text, className) {
      const slot = this.cameraSlots[slotIndex]
      if (!slot) return
      slot.statusText = text
      slot.statusClass = className
    },

    assignSlotForCamera(cameraId) {
      const existingIndex = this.cameraSlots.findIndex(s => s.cameraId === cameraId)
      if (existingIndex !== -1) return existingIndex

      const freeIndex = this.cameraSlots.findIndex(s => !s.cameraId)
      if (freeIndex !== -1) {
        this.cameraSlots[freeIndex].cameraId = cameraId
        return freeIndex
      }

      return this.cameraSlots.length - 1
    },

    /* ---- Scenes ---- */
    sceneSummary(scene) {
      if (!scene || !scene.items) return 'No sources'
      if (!scene.items.length) return 'No sources'
      const labels = scene.items
        .map(i => this.cameraSlots[i.slotIndex]?.label)
        .filter(Boolean)
      return labels.length ? labels.join(' + ') : 'No sources'
    },

    sceneHasSlot(scene, slotIndex) {
      if (!scene || !scene.items) return false
      return scene.items.some(i => i.slotIndex === slotIndex)
    },

    addScene() {
      const id = `scene-${++this.sceneCounter}`
      const scene = {
        id,
        name: `Scene ${this.sceneCounter}`,
        items: [],
      }
      this.scenes.push(scene)
      this.activeSceneId = id
      this.selectedSceneItemId = null
      this.previewMeta = `Scene: ${scene.name}`
    },

    selectScene(id) {
      this.activeSceneId = id
      const scene = this.activeScene
      this.selectedSceneItemId = null
      this.previewMeta = scene ? `Scene: ${scene.name}` : 'Scene: None selected'
      this.attachSceneVideos()
    },

    addSlotToScene(slotIndex) {
      const scene = this.activeScene
      if (!scene) return
      if (this.sceneHasSlot(scene, slotIndex)) return

      const id = `${scene.id}-item-${slotIndex}-${Date.now()}`
      scene.items.push({
        id,
        slotIndex,
        x: 0.05,
        y: 0.05,
        width: 0.9,
        height: 0.9,
      })
      this.selectedSceneItemId = id
      this.attachSceneVideos()
    },

    removeSceneItem(itemId) {
      const scene = this.activeScene
      if (!scene) return
      scene.items = scene.items.filter(i => i.id !== itemId)
      if (this.selectedSceneItemId === itemId) {
        this.selectedSceneItemId = null
      }
      this.attachSceneVideos()
    },

    handleSlotClick(slotIndex) {
      const scene = this.activeScene
      if (!scene) return
      const existing = scene.items.find(i => i.slotIndex === slotIndex)
      if (existing) {
        this.selectedSceneItemId = existing.id
        return
      }
      this.addSlotToScene(slotIndex)
    },

    sceneItemStyle(item) {
      return {
        left: (item.x * 100) + '%',
        top: (item.y * 100) + '%',
        width: (item.width * 100) + '%',
        height: (item.height * 100) + '%',
      }
    },

    /* ---- Drag / Resize ---- */
    startDrag(item, event) {
      this.selectedSceneItemId = item.id
      const canvasEl = event.currentTarget.parentElement
      const rect = canvasEl.getBoundingClientRect()
      this.dragState = {
        item,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: item.x,
        startTop: item.y,
        canvasWidth: rect.width,
        canvasHeight: rect.height,
      }
      window.addEventListener('mousemove', this.onDragMove)
      window.addEventListener('mouseup', this.endDrag)
    },

    onDragMove(event) {
      if (!this.dragState) return
      const ds = this.dragState
      const dx = event.clientX - ds.startX
      const dy = event.clientY - ds.startY

      const nx = ds.startLeft + dx / ds.canvasWidth
      const ny = ds.startTop + dy / ds.canvasHeight

      ds.item.x = Math.min(1 - ds.item.width, Math.max(0, nx))
      ds.item.y = Math.min(1 - ds.item.height, Math.max(0, ny))
    },

    endDrag() {
      this.dragState = null
      window.removeEventListener('mousemove', this.onDragMove)
      window.removeEventListener('mouseup', this.endDrag)
    },

    startResize(item, event) {
      this.selectedSceneItemId = item.id
      const canvasEl = event.currentTarget.parentElement.parentElement
      const rect = canvasEl.getBoundingClientRect()
      this.resizeState = {
        item,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: item.width,
        startHeight: item.height,
        canvasWidth: rect.width,
        canvasHeight: rect.height,
      }
      window.addEventListener('mousemove', this.onResizeMove)
      window.addEventListener('mouseup', this.endResize)
    },

    onResizeMove(event) {
      if (!this.resizeState) return
      const rs = this.resizeState
      const dx = event.clientX - rs.startX
      const dy = event.clientY - rs.startY

      const dw = dx / rs.canvasWidth
      const dh = dy / rs.canvasHeight

      let newWidth = rs.startWidth + dw
      let newHeight = rs.startHeight + dh

      newWidth = Math.max(0.1, Math.min(1 - rs.item.x, newWidth))
      newHeight = Math.max(0.1, Math.min(1 - rs.item.y, newHeight))

      rs.item.width = newWidth
      rs.item.height = newHeight
    },

    endResize() {
      this.resizeState = null
      window.removeEventListener('mousemove', this.onResizeMove)
      window.removeEventListener('mouseup', this.endResize)
    },

    /* ---- Attach streams into scene videos ---- */
    attachSceneVideos() {
      this.$nextTick(() => {
        const attachForItems = (items, refPrefix) => {
          items.forEach(item => {
            const slot = this.cameraSlots[item.slotIndex]
            if (!slot || !slot.cameraId) return
            const camInfo = this.cameras[slot.cameraId]
            if (!camInfo || !camInfo.stream) return

            const ref = this.$refs[refPrefix + item.slotIndex]
            if (!ref) return
            const el = Array.isArray(ref) ? ref[0] : ref
            if (el.srcObject !== camInfo.stream) {
              el.srcObject = camInfo.stream
              try {
                el.play()
              } catch (e) {
                console.warn('[SCENE] play() failed', e)
              }
            }
          })
        }

        attachForItems(this.previewSceneItems, 'sceneVideo-')
        attachForItems(this.liveSceneItems, 'liveSceneVideo-')
      })
    },

    /* ---- TAKE: Preview Scene → Live ---- */
    setLiveFromPreview() {
      const scene = this.activeScene
      if (!scene || !scene.items || !scene.items.length) return

      this.liveScene = {
        id: scene.id,
        name: scene.name,
        items: scene.items.map(i => ({ ...i })),
      }
      this.liveMeta = `On Air: ${scene.name}`

      // Determine which cameras are in the live scene
      const liveCameraIds = Array.from(
        new Set(
          this.liveScene.items
            .map(i => this.cameraSlots[i.slotIndex]?.cameraId)
            .filter(Boolean),
        ),
      )

      // Push live camera list to server so cameras can show LIVE pill
      if (this.socket) {
        this.socket.emit('set-live-cameras', { liveCameraIds })
      }

      // Update status badges on V1–V5
      this.cameraSlots.forEach((slot, index) => {
        if (!slot.cameraId) {
          this.setSlotState(index, 'offline', 'status-offline')
          return
        }
        if (liveCameraIds.includes(slot.cameraId)) {
          this.setSlotState(index, 'LIVE', 'status-live')
        } else {
          this.setSlotState(index, 'online', 'status-online')
        }
      })

      this.attachSceneVideos()
    },

    /* ---- AUDIO MIXER ---- */
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
      this.attachSceneVideos()
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

    /* ---- Recording (mirrored from camera) ---- */
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
      if (!cameraId || !this.socket) return
      if (this.isRecording(cameraId)) {
        this.socket.emit('record-control', { cameraId, action: 'stop' })
      } else {
        this.socket.emit('record-control', { cameraId, action: 'start' })
      }
    },

    /* ---- PROGRAM (MIXED OUTPUT) RECORDING ---- */

    ensureProgramCanvas() {
      if (this.programCanvas && this.programCtx) return
      const canvas = document.createElement('canvas')
      // 16:9 base resolution
      canvas.width = 1280
      canvas.height = 720
      const ctx = canvas.getContext('2d')
      this.programCanvas = canvas
      this.programCtx = ctx

      // Safari sometimes behaves better if canvas is in the DOM
      if (typeof document !== 'undefined' && !document.body.contains(canvas)) {
        canvas.style.position = 'fixed'
        canvas.style.left = '-9999px'
        canvas.style.top = '-9999px'
        canvas.style.width = '1px'
        canvas.style.height = '1px'
        canvas.style.pointerEvents = 'none'
        document.body.appendChild(canvas)
      }
    },

    startProgramRenderLoop() {
      if (this.programRenderLoopRunning) return
      this.programRenderLoopRunning = true

      const loop = () => {
        if (!this.programRenderLoopRunning || !this.programCanvas || !this.programCtx) {
          this.programRenderLoopRunning = false
          return
        }

        const canvas = this.programCanvas
        const ctx = this.programCtx

        // Clear
        ctx.fillStyle = 'black'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const items = this.liveSceneItems
        if (items && items.length) {
          items.forEach(item => {
            const slot = this.cameraSlots[item.slotIndex]
            if (!slot || !slot.cameraId) return

            // 🔴 Instead of camInfo.programVideoEl, use the actual LIVE video element
            const ref = this.$refs['liveSceneVideo-' + item.slotIndex]
            const videoEl = Array.isArray(ref) ? ref[0] : ref

            if (!videoEl || videoEl.readyState < 2) return

            const dx = item.x * canvas.width
            const dy = item.y * canvas.height
            const dw = item.width * canvas.width
            const dh = item.height * canvas.height

            try {
              ctx.drawImage(videoEl, dx, dy, dw, dh)
            } catch (e) {
              // drawImage can throw if video not ready; ignore this frame
            }
          })
        }

        requestAnimationFrame(loop)
      }

      requestAnimationFrame(loop)
    },


    toggleProgramRecording() {
      if (this.programRecording.isRecording) {
        this.stopProgramRecording()
      } else {
        this.startProgramRecording()
      }
    },

startProgramRecording() {
  this.ensureProgramCanvas()
  if (!this.programCanvas) {
    console.warn('[PROGRAM] No program canvas available')
    return
  }

  // Capture from the offscreen canvas (mixed Live scene)
  const stream = this.programCanvas.captureStream(25)
  if (!stream) {
    console.warn('[PROGRAM] captureStream() returned no stream')
    return
  }

  let recorder
  try {
    // IMPORTANT: no mimeType/options. Let browser choose.
    recorder = new MediaRecorder(stream)
  } catch (e) {
    console.error('[PROGRAM] Failed to create MediaRecorder', e)
    return
  }

  console.log('[PROGRAM] MediaRecorder created with mimeType:', recorder.mimeType)

  const startedAt = new Date()
  this.programRecording.recorder = recorder
  this.programRecording.chunks = []
  this.programRecording.startedAt = startedAt
  this.programRecording.elapsedSeconds = 0

  recorder.ondataavailable = (evt) => {
    if (evt.data && evt.data.size > 0) {
      this.programRecording.chunks.push(evt.data)
    }
  }

  recorder.onerror = (evt) => {
    console.error('[PROGRAM] MediaRecorder error:', evt.error || evt)
  }

  recorder.onstop = () => {
    const endedAt = new Date()
    const durationSeconds = this.programRecording.elapsedSeconds

    if (this.programRecording.timerId) {
      clearInterval(this.programRecording.timerId)
      this.programRecording.timerId = null
    }

    if (!this.programRecording.chunks.length) {
      console.warn('[PROGRAM] No data chunks recorded (mimeType =', recorder.mimeType, ')')
      // You can also show a visible error in the UI here if you want.
    } else {
      const mimeType = recorder.mimeType || 'video/webm'
      const blob = new Blob(this.programRecording.chunks, { type: mimeType })
      const baseName = this.makeProgramBaseName(startedAt)

      // Simple extension decision
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      this.downloadBlob(blob, `${baseName}.${ext}`)

      const meta = {
        type: 'program',
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds,
        mimeType,
      }
      const metaBlob = new Blob([JSON.stringify(meta, null, 2)], {
        type: 'application/json',
      })
      this.downloadBlob(metaBlob, `${baseName}.json`)
    }

    this.programRecording.isRecording = false
  }

  // Timer
  this.programRecording.timerId = setInterval(() => {
    this.programRecording.elapsedSeconds += 1
  }, 1000)

  try {
    // Critical for Safari: use a timeslice so ondataavailable fires
    recorder.start(1000) // every 1s
    this.programRecording.isRecording = true
    console.log('[PROGRAM] Started Program recording, mime:', recorder.mimeType)
  } catch (e) {
    console.error('[PROGRAM] recorder.start failed', e)
  }
},

    stopProgramRecording() {
      const pr = this.programRecording
      if (!pr.recorder || !pr.isRecording) return

      try {
        pr.recorder.stop()
      } catch (e) {
        console.error('[PROGRAM] recorder.stop failed', e)
      }

      pr.isRecording = false
      if (pr.timerId) {
        clearInterval(pr.timerId)
        pr.timerId = null
      }
    },

    makeProgramBaseName(dateObj) {
      const iso = dateObj.toISOString().replace(/[:.]/g, '-')
      return `program-${iso}`
    },

    downloadBlob(blob, filename) {
      if (!blob || !blob.size) {
        console.warn('[PROGRAM] Tried to download empty blob for', filename)
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

    /* ---- SOCKET / WEBRTC ---- */
    initSocket() {
       // Always default to HTTPS for signaling (matches your HTTPS server)
      const fallbackUrl = `https://${window.location.hostname}:3000`
      const signalingUrl = import.meta.env.VITE_SIGNALING_URL || fallbackUrl

      console.log('[ADMIN] Connecting to signaling:', signalingUrl)

      this.socket = io(signalingUrl, {
        transports: ['websocket'],
      })


      this.socket.on('connect', () => {
        this.logStatus('Connected. Joining as admin…')
        this.socket.emit('join', { role: 'admin' })
      })


      // Extra logging so Chrome shows you why it fails
      this.socket.on('connect_error', (err) => {
        console.error('[ADMIN] socket connect_error', err)
        this.logStatus('Signaling connection failed: ' + (err.message || err))
      })

      // Recording state from cameras
      this.socket.on('record-state', ({ cameraId, isRecording, elapsedSeconds }) => {
        if (!cameraId) return
        if (!this.recordings[cameraId]) {
          this.recordings[cameraId] = {
            isRecording: !!isRecording,
            elapsedSeconds: elapsedSeconds || 0,
          }
        } else {
          this.recordings[cameraId].isRecording = !!isRecording
          this.recordings[cameraId].elapsedSeconds = elapsedSeconds || 0
        }
      })

      this.socket.on('camera-joined', ({ cameraId }) => {
        console.log('[ADMIN] Camera joined:', cameraId)
        if (!this.cameras[cameraId]) {
          const slotIndex = this.assignSlotForCamera(cameraId)
          this.setSlotState(slotIndex, 'connecting', 'status-connecting')
          this.cameras[cameraId] = { pc: null, stream: null, slotIndex, audioVolume: 1.0, programVideoEl: null }
        }
        this.updateCameraSummary()
      })

      this.socket.on('camera-left', ({ cameraId }) => {
        console.log('[ADMIN] Camera left:', cameraId)
        const info = this.cameras[cameraId]
        if (info) {
          const slotIndex = info.slotIndex

          if (info.pc) {
            try { info.pc.close() } catch (e) {}
          }

          const thumbVideo = this.getThumbVideo(slotIndex)
          if (thumbVideo && thumbVideo.srcObject) {
            thumbVideo.srcObject.getTracks().forEach(t => t.stop())
            thumbVideo.srcObject = null
          }

          if (typeof slotIndex === 'number' && this.cameraSlots[slotIndex]) {
            this.cameraSlots[slotIndex].cameraId = null
            this.setSlotState(slotIndex, 'offline', 'status-offline')
          }

          // Drop recording state
          if (this.recordings[cameraId]) {
            delete this.recordings[cameraId]
          }

          // Clean program video element
          if (info.programVideoEl) {
            try {
              info.programVideoEl.srcObject = null
            } catch {}
            info.programVideoEl = null
          }

          this.teardownCameraAudio(cameraId)
          delete this.cameras[cameraId]
          this.updateCameraSummary()
          this.attachSceneVideos()
        }
      })

      this.socket.on('webrtc-offer', async ({ fromCameraId, sdp }) => {
        this.logStatus(`Received offer from camera ${fromCameraId}`)
        console.log('[ADMIN] webrtc-offer from', fromCameraId, sdp)

        let info = this.cameras[fromCameraId]
        if (!info) {
          const slotIndex = this.assignSlotForCamera(fromCameraId)
          info = { pc: null, stream: null, slotIndex, audioVolume: 1.0, programVideoEl: null }
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
            try {
              thumbVideo.play()
            } catch (e) {
              console.warn('[THUMB] play() failed', e)
            }
          }

          // Hidden video element used only for Program canvas drawImage (Safari-friendly)
          if (!info.programVideoEl) {
            const pv = document.createElement('video')
            pv.muted = true
            pv.playsInline = true
            pv.autoplay = true
            pv.srcObject = stream
            info.programVideoEl = pv
          }

          this.ensureCameraAudio(fromCameraId, stream)
          this.attachSceneVideos()
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
  grid-template-rows: minmax(260px, 1fr) auto auto auto;
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

/* Scenes UI */
.scene-panel {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: #9ca3af;
}

.scene-list {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.scene-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10px;
  color: #6b7280;
}

.scene-btn {
  border-radius: 999px;
  border: 1px solid #4b5563;
  background: #020617;
  padding: 2px 8px;
  font-size: 11px;
  color: #e5e7eb;
  cursor: pointer;
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  min-width: 70px;
}

.scene-btn-name {
  font-weight: 500;
}

.scene-btn-summary {
  font-size: 9px;
  color: #9ca3af;
  opacity: 0.8;
}

.scene-btn-active {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.18);
}
.scene-btn-add {
  border-color: #64748b;
  color: #cbd5f5;
}

.scene-tools {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.scene-tools-label {
  font-size: 10px;
  color: #6b7280;
}

.scene-source-btn {
  border-radius: 999px;
  border: 1px solid #334155;
  background: #020617;
  color: #e5e7eb;
  font-size: 10px;
  padding: 2px 8px;
  cursor: pointer;
}
.scene-source-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* 16:9 wrappers */
.pane-video-wrapper.aspect-16-9 {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: #020617;
  border-radius: 4px;
  overflow: hidden;
}
.pane-video-wrapper.aspect-16-9 > video,
.pane-video-wrapper.aspect-16-9 > .scene-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

.scene-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: #020617;
}

.scene-item {
  position: absolute;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.5);
  cursor: move;
}
.scene-item-selected {
  box-shadow: 0 0 0 1px #38bdf8, 0 0 0 2px rgba(56, 189, 248, 0.5);
}
.scene-item video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.scene-item-remove {
  position: absolute;
  top: 2px;
  right: 2px;
  border: none;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.8);
  color: #f9fafb;
  font-size: 10px;
  line-height: 1;
  padding: 0 5px 2px;
  cursor: pointer;
  z-index: 5;
}
.resize-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: #38bdf8;
}
.resize-handle.br {
  right: 2px;
  bottom: 2px;
  cursor: se-resize;
}

.scene-empty-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #6b7280;
  text-align: center;
  padding: 0 12px;
}

/* TAKE BAR */
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

/* PROGRAM REC BAR */
#program-rec-bar {
  grid-column: 1 / span 2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: -2px;
  margin-bottom: 4px;
  font-size: 11px;
}

.program-label {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 10px;
  color: #9ca3af;
}

.program-rec-button {
  padding: 3px 10px;
}

/* Bottom strip */
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

/* Audio panel */
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

/* Slot statuses */
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
.status-online {
  border-color: rgba(34, 197, 94, 0.6);
  color: #bbf7d0;
  background: rgba(34, 197, 94, 0.08);
}
.status-live {
  border-color: #22c55e;
  color: #22c55e;
  background: rgba(34, 197, 94, 0.18);
}
.status-recording {
  border-color: #ef4444;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.15);
}

/* V1–V5 thumbnails */
.camera-thumb-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: #020617;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}
.camera-thumb-wrapper > video {
  position: absolute;
  inset: 0;
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
.camera-thumb-wrapper.recording-border .camera-thumb-overlay {
  box-shadow: 0 0 0 1px #ef4444, 0 0 12px rgba(239, 68, 68, 0.6);
}

/* Recording UI */
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
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
