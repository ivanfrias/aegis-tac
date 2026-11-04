# Security Policy

## Security & Architecture Philosophy

**Aegis Tac** is designed from the ground up as a **zero-backend, privacy-first peer-to-peer tactical tool**:

- **No Remote Telemetry Databases**: Aegis Tac does not collect, log, or transmit your GPS coordinates, device identifiers, or squad communications to any centralized database.
- **Direct P2P Squad Mesh**: Squad telemetry is communicated directly between peers using WebRTC (`PeerJS`) data channels.
- **Client-Side Encryption**: Squad rooms support secret AES-256 squad PIN encryption for tactical broadcasts.
- **Local Storage Only**: Whitelisted friendly BLE device IDs and user callsign settings stay in your browser's `localStorage` or device memory.

---

## Reporting a Vulnerability

If you discover a security vulnerability or sensitive data exposure in Aegis Tac, please report it responsibly:

1. **Do not create a public issue** disclosing the vulnerability.
2. Open a private security advisory on GitHub under the **Security** tab of the repository (`https://github.com/ivanfrias/airsoft-radar/security/advisories/new`).
3. Provide a clear description, reproduction steps, and potential impact.

We take security reports seriously and will acknowledge receipt and work on a prompt resolution.
