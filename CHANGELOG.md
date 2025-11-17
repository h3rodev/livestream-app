# Changelog

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

