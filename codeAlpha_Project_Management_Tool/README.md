# MeetSphere: Secure Real-Time Video Collaboration

A browser-based video conferencing and collaboration tool: multi-user video calls, screen sharing, end-to-end encrypted chat and file sharing, and a live shared whiteboard, built on WebRTC.

**Live demo:**https://meetsphere-wgr3.onrender.com/

## Features
- Multi-user video/audio calls (WebRTC full mesh, up to 8 participants per room)
- Screen sharing (seamless `replaceTrack`, no renegotiation)
- Mic/camera toggles with live state shown to peers, speaking indicator animation
- **Whiteboard:** pen, eraser, colours, brush size, clear, save as PNG; late joiners get the full drawing history
- **Encrypted chat and file sharing** (max 25 MB, auto-deleted after 2 h)
- Account system: register/login with JWT, bcrypt password hashing
- Shareable invite links (`#room=<code>`), animated responsive UI

## Security & encryption model
| Data | Protection |
|---|---|
| Audio/video | WebRTC mandatory DTLS-SRTP (encrypted peer-to-peer) |
| Chat messages and files | **End-to-end:** AES-256-GCM in the browser, key from PBKDF2-SHA256 (150k iterations) of the room passcode. The server relays/stores ciphertext only |
| Signalling and API | HTTPS/WSS in production, JWT-authenticated sockets, room-scoped relay |
| Passwords | bcrypt (cost 12), rate-limited login |
| Web security | Helmet CSP, Permissions-Policy, input validation, upload size limits |

Note: if no passcode is entered, the room code is used as the secret, so set a passcode for private meetings.

## Architecture
```
Browser A ◄══ WebRTC media (P2P, DTLS-SRTP) ══► Browser B
    │  signalling, encrypted chat, whiteboard strokes        │
    └──────────────► Node/Express + Socket.io ◄──────────────┘
                              │
                          MongoDB (users)      /api/files (ciphertext, temp disk)
```

## Tech stack
WebRTC, Socket.io, Node.js/Express, MongoDB/Mongoose, Web Crypto API, Canvas API, vanilla JS (ES modules), CSS animations.

## Run locally
```bash
npm install
cp .env.example .env
npm start                  # http://localhost:5000  (localhost counts as a secure context)
```
Open two browser windows, register two accounts, join the same room code. `docker compose up --build` also works.

## Deploy (free): MongoDB Atlas + Render
Cameras, screen sharing and encryption **require HTTPS**, which Render provides automatically.
1. Create a free Atlas M0 cluster and copy its connection string.
2. Push this repo to GitHub.
3. Render → New → Web Service → select repo. Build `npm install`, Start `npm start`.
4. Env vars: `MONGODB_URI`, `JWT_SECRET`, and optionally `TURN_URL`, `TURN_USER`, `TURN_PASS`.
5. Open the URL in two devices to test.

**TURN server:** STUN alone fails for some users behind strict NATs/corporate firewalls. For reliability add a free TURN account (e.g. metered.ca) and set the TURN variables.

## Push to GitHub
```bash
git init && git add . && git commit -m "Initial commit: MeetSphere"
git branch -M main
git remote add origin https://github.com/<your-username>/meetsphere.git
git push -u origin main
```

## Limitations (good interview talking points)
- Full-mesh topology scales to ~6-8 users; larger rooms need an SFU (mediasoup, LiveKit).
- Uploaded files use temporary disk storage; production would use S3-compatible storage.
- Shared-passcode E2E is simple and transparent; a production system would use per-user keys (e.g. MLS/Signal protocol).

## Resume bullets
- Built a WebRTC video conferencing platform (Node.js, Socket.io) with multi-user calls, screen sharing, and a real-time collaborative whiteboard.
- Designed an end-to-end encrypted chat and file-sharing layer with Web Crypto (AES-256-GCM, PBKDF2) so the server only handles ciphertext.
- Implemented JWT/bcrypt authentication, a signalling server with room-scoped relay and rate limiting; deployed on Render with STUN/TURN support.

---
## What's new in v1.1
- **Emoji reactions** that float across the stage for everyone, and **raise-hand** badges with notifications
- **Pin / spotlight** any participant by clicking their tile
- **People panel**, meeting **timer**, unread-message badge on chat
- **Microphone level meter** in the pre-join lobby to check your mic before you enter
- Animated landing page with a live call mock-up
- Repo hygiene: GitHub Actions CI, `render.yaml` blueprint (one-click Render deploy), Dockerfile, MIT licence

## Screenshots
Place images in `docs/screenshots/` and embed them here, e.g. `![Meeting room](docs/screenshots/room.png)`.
