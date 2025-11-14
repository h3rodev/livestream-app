# Changelog

All notable changes to Livestream App will be documented here.

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