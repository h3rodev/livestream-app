# Livestream App — Architecture Overview

This document describes the architecture for Phase 1 and the direction for future phases.

### 📡 High-Level Architecture (Phase 1)

┌─────────────────────────┐
│       Mobile Camera     │
│  (camera.html / Safari) │
│  - getUserMedia         │
│  - WebRTC Peer          │
└─────────────┬───────────┘
              │ Offer + ICE
              │ via HTTPS + Socket.IO
┌─────────────▼────────────┐
│    Node.js Signaling     │
│     HTTPS + Socket.IO    │
│  server/src/index.js     │
│                          │
│  - Handles:              │
│    • join events         │
│    • offer/answer relay  │
│    • ICE forwarding      │
│    • camera/admin map    │
└─────────────┬────────────┘
              │ Answer + ICE
              │ via HTTPS + Socket.IO
┌─────────────▼────────────┐
│       Admin Viewer        │
│  (admin.html / Chrome)    │
│  - WebRTC Peer            │
│  - Manual video playback  │
└───────────────────────────┘

### Key Decisions in Phase 1:

* HTTPS is mandatory to allow iPhone Safari camera access across LAN.

* Manual video playback avoids autoplay restrictions on Chrome & Safari.

* Socket.IO provides reliable signaling.

* H.264 ensures Safari → Chrome compatibility.

* Architecture is intentionally simple but scalable.

### 🧩 Phase 2+ Architectural Expansion
#### Multi-Camera Grid

Admin will manage multiple WebRTC peers:

camera1 →│
camera2 →│→ Admin (grid)
camera3 →│


#### Recording Pipeline (Phase 3)

Server will branch incoming WebRTC tracks to recorder workers:

Camera Stream → WebRTC → Admin  
                 │  
                 └→ Recorder (FFmpeg or MediaRecorder)
                        ↓
                     SSD/NAS


### Desktop Admin (Electron)

##### Electron UI will integrate:

* WebRTC client

* RTMP/SRT encoder

* Scene compositor

##### Mobile App (Flutter)

* Flutter will wrap:

* Custom camera module

* WebRTC library

* Better camera controls