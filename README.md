# 📡 Livestream App — Phase 1

Multi-Camera WebRTC Livestreaming System (Admin + Mobile Camera)
Status: MVP Phase 1 Complete
Features: HTTPS Signaling Server, Multi-Camera Discovery, Manual-Play WebRTC Streaming

## 🚀 Overview

Livestream App is a multi-camera livestreaming platform designed to use mobile phones as video sources and stream them to a browser-based Admin Dashboard in real time.

This project implements Phase 1 of the system:

* Local HTTPS Signaling Server using Node.js + Socket.IO

* Camera UI (mobile) → sends WebRTC video

* Admin UI → receives stream (manual play)

* Multiple cameras can join and be discovered by the admin

* Secure origin support (mandatory for iOS Safari camera access)

This forms the foundation for future phases including multi-camera grid, recording per camera, shared SSD ingest, timestamp synchronization, OBS/SRT output, desktop admin app (Electron), and mobile app (Flutter).

## 📦 Project Structure

livestream-app/
├── server/
│ ├── src/
│ │ └── index.js (HTTPS signaling server with WebRTC + Socket.IO)
│ ├── certs/ (local dev HTTPS certs — ignored by Git)
│ └── package.json
└── public/
├── admin.html (Admin UI – receives WebRTC streams)
├── camera.html (Camera UI – sends WebRTC stream)

## 🔐 HTTPS Setup (Required for iOS Safari)

Safari on iPhone/iPad requires HTTPS for camera/microphone access unless using localhost.

1. Install mkcert

brew install mkcert nss
mkcert -install

2. Generate local certificates

cd server/certs
mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 192.168.1.50
(Replace 192.168.1.50 with your actual LAN IP)

3. Git automatically ignores certificate files

server/certs/

## ▶️ Running the Server

cd server
npm install
npm run dev

Expected output:
HTTPS signaling server listening on https://localhost:3000

Admin UI: https://localhost:3000/admin.html

Camera UI: https://localhost:3000/camera.html

## 📱 Connecting a Camera (Mobile)

* Connect phone to same Wi-Fi

Open in Safari/Chrome:
https://<your-lan-ip>:3000/camera.html
Example:
https://192.168.1.50:3000/camera.html

* Accept HTTPS warning

* Allow camera + microphone

* Tap Start Streaming

### 💻 Admin Viewer (Desktop)

Open:
https://localhost:3000/admin.html

* Accept certificate warning

* Camera appears in the list

* Video attaches automatically

* Click Play manually (autoplay disabled intentionally)

## 🧩 Phase 1 Features
### ✔️ HTTPS Signaling Server

* Camera join/leave

* Admin join

* WebRTC Offer/Answer

* ICE candidate forwarding

### ✔️ WebRTC Streaming

* Safari → Chrome compatible

* H.264 support

* Manual playback avoids autoplay restrictions

### ✔️ Multi-Camera Discovery

* Real-time camera list updates

* Attach stream per camera

### ✔️ Secure Origin Support

* Required for mobile Safari

* mkcert certificates enable LAN HTTPS

### 🛡 .gitignore Highlights

server/certs/
node_modules/
.env

The certificate directory is excluded for safety.

🧭 Roadmap (Next Phases)
### Phase 2 — Multi-Camera Grid

* Real-time layout

* Auto-scaling

* Camera indicators

### Phase 3 — Recording

* Per-camera MP4

* NAS/SSD integration

### Phase 4 — Sync + Timeline

* Frame timestamps

* Premiere/Resolve export

### Phase 5 — Admin Desktop App (Electron)

* OBS-style viewer

* Scene management

* RTMP/SRT outputs

### Phase 6 — Mobile App (Flutter)

* High bitrate

* Manual controls

* Battery + network monitoring

### 🤝 Contributing

PRs will be accepted starting Phase 2.

### 📄 License

To be added once architecture stabilizes.