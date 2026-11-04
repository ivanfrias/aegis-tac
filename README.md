# Aegis Tac // Tactical BLE Proximity Radar & WebRTC P2P Squad Net

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.3.1-blue.svg)](package.json)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8.6-119EFF.svg)](https://capacitorjs.com/)
[![WebRTC](https://img.shields.io/badge/Mesh-WebRTC%20P2P-333333.svg)](https://peerjs.com/)

A zero-backend, mobile-first Progressive Web App (PWA) and native Android / Wear OS smartwatch tactical suite for airsoft and milsim players. Aegis Tac combines **Bluetooth Low Energy (BLE) RSSI proximity detection**, **serverless WebRTC squad telemetry**, and a **tactical GPS satellite & topo map overlay**.

---

## Key Features

- **Tactical 360° Proximity Radar (`src/components/RadarDisplay.tsx`)**:
  - Sweeping HUD radar with real-time compass heading integration (`DeviceOrientationEvent`).
  - Signal filtering using Exponential Moving Average (EMA) and Log-Distance Path Loss presets (**CQB 20m**, **Compound 40m**, **Woodland 75m**).
  - Proximity arcs narrowing toward peak signal strength to give bearing estimation.
  - Signal trend indicators (`▲ CLOSING`, `▼ RECEDING`, `• STABLE`).
  - Swarm filters: show closest 5, all contacts, or hide bogeys.
  - Zoom controls (0.5x, 1x, 2x, 4x) for tight CQB or wide woodland scenarios.

- **Wear OS Smartwatch HUD (`src/components/WatchHudModal.tsx`, `WatchRadarView.java`)**:
  - Compact standalone tactical watch interface designed for round AMOLED screens.
  - Dual-mode: Web HUD simulation and native Wear OS activity with custom low-power canvas rendering.
  - Quick-action buttons: In-game callsign rename, squad proximity claim, bogey acoustic ping trigger, and exit.

- **Zero-Backend WebRTC Squad Mesh (`src/services/squadP2P.ts`)**:
  - P2P encrypted squad sync using WebRTC (`PeerJS`) with shared Room Code and optional secret PIN.
  - Instant local fallback via `BroadcastChannel` for multi-tab simulation.
  - Real-time GPS sharing, tactical markers (**ENEMY**, **DANGER**, **OBJECTIVE**), and squad status (**IN PLAY**, **HIT / DEAD**, **MEDIC!**).
  - Multi-tier IFF (Identification Friend or Foe):
    - **Green**: Squad members
    - **Blue**: Allied / friendly units
    - **Orange / Red**: Unknown / Bogey BLE contacts (pulsing warning based on proximity)

- **Tactical Satellite & Topo Map (`src/components/MapOverlay.tsx`)**:
  - Seamless Leaflet toggleable satellite (Esri World Imagery) and topographic (OpenTopoMap) base layers.
  - Real-time GPS squadmate locations and interactive tactical map pings.

- **Camouflage Tactical Themes**:
  - Built-in tactical camouflages (Multicam, Woodland, Night Camo) for AMOLED devices, tablets, and field smartphones.

---

## Compatibility

| Platform | Web BLE Scanning | WebRTC Squad Net | GPS & Compass | Native Watch HUD |
| :--- | :---: | :---: | :---: | :---: |
| **Android (Chrome)** | Full (`#enable-experimental-web-platform-features`) | Full | Full | - |
| **Android (Native APK)** | Full (Native Bluetooth LE) | Full | Full | - |
| **Wear OS Smartwatch** | Standalone Native Bridge | Full | Hardware GPS | Full Canvas HUD |
| **iOS / iPhone (Bluefy)** | Full (via Bluefy BLE Browser) | Full | Full | - |
| **Desktop (Chrome / Edge)** | Full | Full | Emulated / GPS | Simulation Mode |

---

## Quick Start (Web PWA)

### 1. Prerequisites
- Node.js 20+
- npm 9+

### 2. Development Server
```bash
git clone https://github.com/ivanfrias/airsoft-radar.git
cd airsoft-radar
npm install
npm run dev
```
Open `http://localhost:5173` on your workstation or mobile browser.

### 3. Static Production Build
```bash
npm run build
```
The output is written to `dist/`.

---

## Native Android & Wear OS APK

A standalone pre-built debug APK is included in `public/aegistac.apk`.

To install directly to an Android phone or Wear OS watch via ADB:
```bash
adb install public/aegistac.apk
```

To build the native APK from source:
```bash
npm run cap:sync
cd android
./gradlew assembleDebug
```
The generated APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## Free Zero-Backend Deployment (Automatic HTTPS)

Browsers require **HTTPS** for Web Bluetooth, Geolocation, and Device Orientation sensors. Deploy `dist/` directly to any static host:

- **Vercel**: Import the repository with build command `npm run build` and output directory `dist`.
- **Cloudflare Pages**: Connect repo, set build command to `npm run build` and output to `dist`.
- **GitHub Pages**: Deploy `dist/` to your `gh-pages` branch (`vite.config.ts` uses `base: './'`).

---

## Security & Privacy

Aegis Tac is strictly serverless. No personal data, location tracks, or BLE identifiers are ever stored in a remote cloud database. For more information, please see [SECURITY.md](SECURITY.md).

---

## Contributing

Contributions, bug reports, and suggestions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on submitting pull requests.

---

## License

This project is open-source software licensed under the [MIT License](LICENSE).
