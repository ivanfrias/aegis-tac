# Aegis Tac // Tactical Bluetooth Radar PWA & Wear OS App

A zero-backend, mobile-first Progressive Web App (PWA) and native Android/Wear OS smartwatch app for airsoft players that combines **Web Bluetooth & Native BLE RSSI proximity detection** with **serverless WebRTC P2P Squad Telemetry (`PeerJS`)** and a **Leaflet Satellite/Topo Map Overlay**.

## Key Features

- **Web Bluetooth Proximity Engine (`src/services/bleScanner.ts`):**
  - **Passive BLE Sweep (`requestLEScan`):** Continuously listens for nearby Bluetooth Low Energy advertisements (`rssi`, `txPower`, `device.id`, `device.name`).
  - **Pair & Whitelist Beacon (`requestDevice`):** Pair a teammate's BLE beacon/watch/phone and whitelist it across the squad as a Friendly diamond marker.
  - **EMA Signal Filtering & Distance Estimation:** Converts noisy RSSI (dBm) into meters using configurable Log-Distance Path Loss presets (`CQB 20m`, `Compound 40m`, `Woodland 75m`) and computes signal trend (`▲ CLOSING`, `▼ RECEDING`, `• STABLE`).
  - **Bogey Proximity Arcs:** Unknown BLE contacts render as pulsing Heartbeat-Sensor proximity arcs that narrow toward the compass bearing where signal strength peaks.
- **Zero-Backend WebRTC P2P Squad Net (`src/services/squadP2P.ts`):**
  - Enter a shared Squad Room Code (e.g., `ECHO-4`) and Callsign.
  - Automatically links squadmates peer-to-peer via WebRTC (`PeerJS`) + `BroadcastChannel` (for instant multi-tab local testing).
  - Syncs live GPS coordinates, compass heading, player status (`IN PLAY`, `HIT / DEAD`, `MEDIC!`), whitelisted friendly BLE IDs, and tactical pings (`ENEMY`, `DANGER`, `OBJECTIVE`).
- **Tactical 360° Radar & Satellite Map (`src/components/RadarDisplay.tsx`, `src/components/MapOverlay.tsx`):**
  - Rotating radar sweep with head-up compass orientation (`DeviceOrientationEvent`) and toggleable Esri Satellite / OpenTopoMap underlay.

---

## Quick Start

```bash
npm install
npm run dev
```

Build the static production bundle:

```bash
npm run build
```

---

## Mobile Browser Web Bluetooth Setup

1. **Android / Desktop (Google Chrome):**
   - Paste `chrome://flags/#enable-experimental-web-platform-features` into Chrome's address bar, set it to **Enabled**, and relaunch Chrome to unlock continuous passive BLE scanning (`navigator.bluetooth.requestLEScan`).
2. **iOS / iPhone:**
   - Apple Safari does not support Web Bluetooth. Install the free **Bluefy – Web BLE Browser** from the iOS App Store and open the deployed `HTTPS` URL inside Bluefy.

---

## Free Zero-Backend Deployment (Automatic HTTPS)

Because `npm run build` outputs a pure static `dist/` folder, you can deploy it for free with automatic SSL (`HTTPS` is required by mobile browsers for Web Bluetooth, GPS, and Compass sensors):

- **Vercel:** Run `npx vercel` or import the repository on Vercel (Framework Preset: `Vite`, Output Directory: `dist`).
- **Cloudflare Pages:** Connect the repository with build command `npm run build` and output directory `dist`.
- **GitHub Pages:** Push `dist/` to your `gh-pages` branch (`vite.config.ts` uses `base: './'` so relative asset paths work out of the box).
