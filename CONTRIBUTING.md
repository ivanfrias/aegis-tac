# Contributing to Aegis Tac

Thank you for your interest in contributing to **Aegis Tac**! We welcome bug reports, feature requests, documentation improvements, and code contributions.

---

## Code of Conduct

Please be respectful, constructive, and helpful when participating in issues and pull requests. We aim to keep Aegis Tac an open, welcoming tactical tool for airsoft and milsim players worldwide.

---

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **npm**: v9 or higher
- **Android Studio & SDK** (optional, for Android/Wear OS native builds):
  - Java JDK 21+
  - Android SDK Platform 34+
  - Android Command-line Tools

### Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/ivanfrias/airsoft-radar.git
   cd airsoft-radar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the local Vite development server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:5173` in a Web Bluetooth capable browser (e.g. Google Chrome with `#enable-experimental-web-platform-features` enabled).

---

## Project Structure

```text
airsoft-radar/
├── android/               # Native Android & Wear OS watch bridge module (Capacitor)
│   └── app/src/main/java/com/aegistac/radar/
│       ├── MainActivity.java
│       ├── PhoneBridgeActivity.java
│       └── WatchRadarView.java
├── public/                # Static assets & standalone APK distribution
│   ├── aegistac.apk
│   └── manifest.json
├── src/
│   ├── components/        # React UI components (Radar, Watch HUD, Map, Settings)
│   ├── services/          # Tactical engines:
│   │   ├── bleScanner.ts  # Web Bluetooth & Native BLE RSSI scanning & filters
│   │   └── squadP2P.ts    # WebRTC (PeerJS) serverless squad mesh & encryption
│   ├── types.ts           # Core TypeScript type definitions
│   ├── App.tsx            # Main application shell
│   └── main.tsx           # React entry point
└── package.json
```

---

## Submitting Pull Requests

1. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

2. **Verify builds**:
   Ensure both TypeScript compilation and the production bundle succeed:
   ```bash
   npm run build
   ```

3. **Check for PII or Secrets**:
   Never commit private tokens, passwords, local absolute paths, or personal contact info.

4. **Commit & Push**:
   Use clear, conventional commit messages:
   ```bash
   git commit -m "feat(radar): add custom range rings"
   git push origin feature/your-feature-name
   ```

5. **Open a PR**:
   Describe the motivation, changes made, and test steps performed on desktop/mobile or Wear OS hardware.

---

## License

By contributing to Aegis Tac, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
