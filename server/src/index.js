import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static client files (../public)
const publicDir = path.join(__dirname, "..", "..", "public");
app.use(express.static(publicDir));

const PORT = process.env.PORT || 3000;

// HTTPS credentials (local dev certs)
const certsDir = path.join(__dirname, "..", "certs");
const httpsOptions = {
  key: fs.readFileSync(path.join(certsDir, "key.pem")),
  cert: fs.readFileSync(path.join(certsDir, "cert.pem")),
};

// Create HTTPS server (main)
const httpsServer = https.createServer(httpsOptions, app);

// Optional: also create HTTP that redirects to HTTPS (nice for desktop)
const httpApp = express();
httpApp.use((req, res) => {
  const host = req.headers.host || "";
  const httpsHost = host.replace(/:\d+$/, `:${PORT}`);
  res.redirect(`https://${httpsHost}${req.url}`);
});
const httpServer = http.createServer(httpApp);

// Socket.IO on HTTPS
const io = new Server(httpsServer, {
  cors: {
    origin: "*",
  },
});

// In-memory tracking of connected roles
const cameras = new Map(); // socketId -> { joinedAt }
const admins = new Map();  // socketId -> { joinedAt }

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("join", ({ role }) => {
    console.log(`Socket ${socket.id} joined as ${role}`);

    if (role === "camera") {
      cameras.set(socket.id, { joinedAt: Date.now() });

      // Notify all admins that a new camera is available
      admins.forEach((_, adminId) => {
        io.to(adminId).emit("camera-joined", {
          cameraId: socket.id,
        });
      });
    } else if (role === "admin") {
      admins.set(socket.id, { joinedAt: Date.now() });

      // Notify this admin of any already-connected cameras
      cameras.forEach((_, cameraId) => {
        io.to(socket.id).emit("camera-joined", {
          cameraId,
        });
      });
    }
  });

  // Camera sends offer -> server -> admin(s)
  socket.on("webrtc-offer", ({ toAdminId, sdp }) => {
    console.log(`Offer from camera ${socket.id} to admin ${toAdminId || "all"}`);

    if (toAdminId) {
      // Direct to specific admin
      io.to(toAdminId).emit("webrtc-offer", {
        fromCameraId: socket.id,
        sdp,
      });
    } else {
      // Broadcast to all admins (Phase 1: assume only one admin)
      admins.forEach((_, adminId) => {
        io.to(adminId).emit("webrtc-offer", {
          fromCameraId: socket.id,
          sdp,
        });
      });
    }
  });

  // Admin sends answer -> server -> camera
  socket.on("webrtc-answer", ({ toCameraId, sdp }) => {
    console.log(`Answer from admin ${socket.id} to camera ${toCameraId}`);
    if (!toCameraId) return;

    io.to(toCameraId).emit("webrtc-answer", {
      fromAdminId: socket.id,
      sdp,
    });
  });

  // Either side sends ICE candidate
  socket.on("webrtc-ice-candidate", ({ targetId, candidate }) => {
    if (!candidate) return;

    if (!targetId) {
      // Broadcast from camera to all admins
      console.log(`Broadcast ICE from ${socket.id} to all admins`);
      admins.forEach((_, adminId) => {
        io.to(adminId).emit("webrtc-ice-candidate", {
          fromId: socket.id,
          candidate,
        });
      });
    } else {
      console.log(`ICE from ${socket.id} to ${targetId}`);
      io.to(targetId).emit("webrtc-ice-candidate", {
        fromId: socket.id,
        candidate,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);

    const wasCamera = cameras.delete(socket.id);
    const wasAdmin = admins.delete(socket.id);

    if (wasCamera) {
      admins.forEach((_, adminId) => {
        io.to(adminId).emit("camera-left", {
          cameraId: socket.id,
        });
      });
    }
  });
});

// Start HTTPS + HTTP redirect
httpsServer.listen(PORT, () => {
  console.log(`HTTPS signaling server listening on https://localhost:${PORT}`);
  console.log(`Admin UI:  https://localhost:${PORT}/admin.html`);
  console.log(`Camera UI: https://localhost:${PORT}/camera.html`);
});

httpServer.listen(8080, () => {
  console.log("HTTP redirect server on http://localhost:8080 -> HTTPS");
});
