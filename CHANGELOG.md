# Changelog

## [0.2.0] – Scene System Milestone (2025-11-25)

### Added
- Full OBS-style Scene System:
  - Create, rename, delete scenes
  - Persistent scenes via `localStorage`
  - Drag-and-resize scene elements (camera sources)
  - Prevent adding the same camera source twice to a scene
- Scene-based TAKE system that sends rendered output to Live
- Live output now uses rendered Scene Canvas instead of raw camera feeds
- 16:9 enforced aspect ratio for:
  - Preview pane
  - Scene Canvas
  - Live pane
  - V1–V5 camera thumbnails
- Two-way recording sync between Admin and Camera:
  - Admin triggers camera recording
  - Camera sends back record-state (timer + status)
- Two-way live-state sync:
  - Only cameras used in Live scene show LIVE indicator
  - Admin and Camera views stay in sync

### Improved
- Stabilised camera slot assignment (V1–V5):
  - Slots persist across refresh
  - Slots are correctly freed on camera disconnect
  - Reconnecting cameras reuse the correct slot
- Camera thumbnail video playback restored across refresh and scene changes
- More resilient WebRTC handling and ICE reconnection logic
- Cleaned UI padding and layout to support strict 16:9 workflow

### Notes
- This milestone establishes a stable baseline for:
  - Multi-platform streaming output (RTMP / WebRTC)
  - Program output recording
  - Overlays (graphics, lower-thirds, logos)
  - Scene presets (PiP, side-by-side, etc.)



## v0.3.0 – Admin–Camera Recording Sync & Audio Mixer Fix
**Date:** 2025-11-24

### Added
- Bi-directional recording control between Admin and Camera:
  - Admin can start/stop per-camera recordings from the V1–V5 slots.
  - Camera can start/stop recording locally and the Admin UI mirrors the recording state.
- `live-state` signalling:
  - Admin designates a single camera as LIVE.
  - Only the selected camera shows a LIVE indicator on the Camera UI.
- Automatic upload of camera recordings to the server via `/api/upload-recording` with per-camera folders and JSON metadata.

### Changed
- Audio mixer behaviour on Admin:
  - When the mixer is enabled, all currently connected camera streams are now attached automatically.
  - Each active camera appears as a separate audio source with its own gain control.
- Admin slot status logic:
  - Explicit separation of `offline`, `connecting`, `online`, and `LIVE` states.
  - Exactly one camera at a time is marked as `LIVE`, all other connected cameras show as `online`.

### Fixed
- Recording state desynchronisation:
  - Stopping a recording on Camera now correctly stops the corresponding recording on Admin (and vice versa) without event loops.
- Inconsistent audio source list:
  - Audio panel no longer misses already-connected cameras when enabling the mixer after streams are live.

### Files touched (high-level)
- `server/src/index.js`
  - Added `live-state`, `record-control`, and `record-state` events.
  - Centralised upload handling for camera recordings.
- `admin-ui/src/App.vue`
  - Integrated audio mixer attachment for existing camera streams.
  - Implemented synced recording logic and refined slot status handling.
- `camera-ui/src/App.vue`
  - Added LIVE indicator and recording control wiring from Admin.
  - Implemented auto-upload and local download of camera recordings.



All notable changes to Livestream App will be documented here.

### 🏷 Release v0.1.5 — Multi-Camera Admin Layout Upgrade
Tag: v0.1.5
Title: Phase 1.5 – Multi-Camera Admin Layout (Preview + Live)
Status: Stable
Type: Feature Release

### 🚀 What’s New in v0.1.5

This update introduces a fully redesigned Admin UI built for real-world multicam livestream control.

The new layout follows an industry-standard workflow:

* Preview monitor (left)

* Live/Program monitor (right)

* Camera thumbnails V1–V5 (bottom row)

* Audio panel (bottom-left placeholder)

This brings the admin experience closer to professional switchers (ATEM Mini, vMix, OBS Studio).

### 🆕 Key Features Added
##### ⭐ Modern Two-Monitor Production Layout

* Dedicated Preview pane

* Dedicated Live (Program) pane

* Full responsive redesign

* Clean dark UI for low-light environments

### ⭐ Multi-Camera Thumbnail Grid

* Up to 5 camera slots (V1–V5)

* Real-time camera state:
-offline
-connecting
-live
-previewing

* Auto-map new cameras to empty slots

* Automatic cleanup when cameras disconnect

### ⭐ Preview → Live Switching

* Click any camera thumbnail → loads Preview

* Press TAKE → sends Preview → Live

* Industry-correct switcher workflow

### ⭐ Connection Reliability Improvements

* Full camera→admin WebRTC stream mapping

* Automatic fallback for first Preview & first Live

* Auto-refresh of per-camera indicators

### ⭐ Cleaner, Scalable Code Architecture

* Isolated camera slot mapping

* Cleaner event handling

* Consolidated ICE candidate flow

* Unified CSS system for UI state

### 🪲 Fixes Included

* Fixed inconsistent slot updates when cameras rapidly join/leave

* Resolved race conditions in initial Preview assignments

* Cleaned up old layout CSS and replaced with grid system

* Stabilised initial take-to-live behaviour

* Improved Safari handling for video containers

### 📁 Files Modified in v0.1.5

* /public/admin.html → Full rewrite (UI + UX + logic)

* /public/camera.html → no change

* /server/src/index.js → no change

* /public/styles.css → replaced inline in admin

### 📘 Compatibility Notes
* Platform	Status
* Safari Admin + Chrome Cameras	Works
* Chrome Admin + Chrome Cameras (Incognito)	Works
* Chrome (with extensions) Cameras	May require disabling some WebRTC-blocking extensions

No breaking changes for cameras.

### 🔜 Upcoming in v0.2.x

* Camera naming (editable labels)

* Bitrate/FPS/Resolution display per camera

* Audio meters + device selection

* Server-side multi-camera recording

* Timecode sync overlay

* Auto-grid thumbnail scaling

* Scene presets

* OBS / RTMP / SRT output

### 📥 How to Update

If you already pulled the repo:

git pull origin main


If you need the tag:

git fetch --tags
git checkout v0.1.5



## Phase 1 — Initial MVP (2025-02)
##### Added
* HTTPS signaling server using Node.js + Socket.IO

* Local development certificate support using mkcert

* Camera UI (camera.html) with WebRTC capture

* Admin UI (admin.html) with manual-play WebRTC playback

* Camera discovery (join/leave events)

* WebRTC Offer/Answer exchange

* ICE candidate forwarding between camera and admin

* Safari → Chrome compatibility (H.264)

* Manual video playback to avoid autoplay restrictions

* Robust logging for debugging WebRTC

* Basic project structure for expansion

##### Fixed

* iPhone Safari camera access blocked due to insecure origin → solved via HTTPS

* AbortError issues due to autoplay → solved by manual-play architecture

* Multiple ontrack events causing interruptions → stabilized attachment logic

##### Security

* Certificates stored under server/certs/ and ignored by Git

* HTTPS enabled for all LAN connections

* Local certificates restricted to development use only

