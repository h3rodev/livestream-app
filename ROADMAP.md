# Livestream App — Roadmap

This roadmap outlines the future direction of the Livestream App.
Timelines are flexible, but priority order is accurate.

## Phase 2 — Multi-Camera Grid Layout (Next Up)

* Grid display for all connected cameras

* Automatic resizing & responsive layout

* Ability to click a camera to enlarge (solo view)

* Per-camera connection status (fps, bitrate, ping)

* Admin camera selection for focus mode

## Phase 3 — Recording System

* Record each incoming WebRTC stream

* Save to shared SSD or NAS storage

* Choose recording format (MP4 / WebM)

* Per-camera timestamp JSON

* Auto-stop and auto-save functionality

* File naming convention:
CAMERA-ID_YYYY-MM-DD_HH-MM-SS.mp4

## Phase 4 — Sync & Timeline Tools

* Embedded timestamp overlay per camera

* Audio clap marker generator

* Automatic sync tool that generates:

* Premiere Pro XML

* DaVinci Resolve timeline

* Final Cut Pro XML

* Metadata export:
session.json with camera list, start/end time, offsets

## Phase 5 — Desktop Admin App (Electron)

* OBS-like preview layout

* Multi-camera switching

* Layer-based composition (graphics, lower-thirds)

* Local recording with hardware acceleration

* Stream out to:
-RTMP (YouTube/Facebook)
-SRT (low-latency professional streaming)
-RTSP (local NVR or encoder)

* Hotkeys for switching sources

## Phase 6 — Mobile App (Flutter)

* Clean UI for camera operators

* Manual camera controls:
-ISO, shutter, white balance
-Exposure lock
-Focus lock
-Zoom

* High bitrate support (10Mbps–30Mbps)

* Battery + temperature reporting

* Network quality indicator

* Audio gain control

* Background mode preview

## Phase 7 — Cloud + Remote Monitoring

* Stream via TURN or SRT Relay

* Remote camera management

* Cloud dashboard with status overview

* Multi-location synchronization

## Phase 8 — Professional Features

* LUT preview

* Waveform & vectorscope

* Tally lights system

* Talkback intercom

* Stream graphics templates

* MIDI controller compatibility

This roadmap adapts as the project grows.
Community feedback and real-world needs may adjust priorities.