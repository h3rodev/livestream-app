# Livestream App — Phase 1 Release Notes

Release Date: 2025-02
Version: Phase 1 MVP

### 🎉 Summary

This is the first working milestone of the Livestream App:
a functional WebRTC-based multi-camera streaming system capable of capturing from mobile Safari and viewing streams from desktop Chrome over a secure LAN.

The foundation of the entire livestreaming platform is now established.

### 🚀 What’s Included
✔️ Fully working HTTPS Signaling Server

* Node.js

* Socket.IO

* Offer/Answer exchange

* ICE candidate forwarder

* Join/Leave notifications

### ✔️ Camera Streaming (Mobile Safari / Chrome Mobile)

* Uses getUserMedia

* Sends WebRTC video

* H.264 codec support

* Automatic connection to admin

### ✔️ Admin Viewer (Desktop)

* Accepts incoming streams

* Freshly attached WebRTC MediaStream

* Manual video playback (autoplay safe)

### ✔️ Multi-Camera Aware

* Admin sees cameras as they join

* Cameras reconnect gracefully

* Disconnect notifications

### ✔️ HTTPS Support for iOS

* mkcert-based local certificates

* iPhone camera access works across LAN

* Self-signed cert accepted once, then trusted

### 🛠 Fixes Completed During Phase 1

* Safari blocking camera access over HTTP → solved with HTTPS

* Chrome’s autoplay restriction causing AbortError → solved with manual-play strategy

* Multiple ontrack events causing stream reload → stabilized attachment

* Socket reconnection handling improved

* Prevented certificate files from being committed to Git

### 🧱 Foundation for Next Phases

* Phase 1 enables the following upcoming features:

* Multi-camera grid

* Recording per camera

* Timestamp-based sync

* Electron admin app

* Flutter mobile app

* SSD/NAS recording pipeline

* RTMP/SRT output

### 📌 Known Limitations (Expected)

* No SSRP/SRT/RTMP output yet

* No recording

* No multi-camera UI

* No bandwidth adaptation

* No camera controls

* No mobile apps

* Requires manual Play button

* These are planned for Phases 2–6.