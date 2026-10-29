import { Capacitor } from '@capacitor/core';
import { BleClient, ScanMode } from '@capacitor-community/bluetooth-le';
import {
  BleContact,
  ENVIRONMENT_CONFIG,
  EnvironmentPreset,
  SignalTrend,
  WhitelistedDevice,
} from '../types/radar';

// Web Bluetooth Experimental Type Definitions
interface WebBleAdvertisingEvent {
  device: {
    id: string;
    name?: string;
    watchAdvertisements?: () => Promise<void>;
  };
  name?: string;
  rssi?: number;
  txPower?: number;
  uuids?: Array<string | number>;
  manufacturerData?: Map<number, DataView>;
  serviceData?: Map<string, DataView>;
}

const BLE_COMPANY_NAMES: Record<number, string> = {
  0x0075: 'Samsung (Watch/Phone/Tag)',
  0x004c: 'Apple (iPhone/Watch/AirTag)',
  0x00e0: 'Google / WearOS',
  0x0087: 'Garmin Watch',
  0x038f: 'Xiaomi / Mi Band',
  0x0157: 'Amazfit / Huami Watch',
  0x027d: 'Huawei Watch/Phone',
  0x012d: 'Sony Audio/Device',
  0x009e: 'Bose Audio',
  0x0047: 'Polar Watch/Sensor',
  0x0059: 'Nordic BLE Tag',
  0x0006: 'Microsoft Device',
  0x0310: 'Oppo / OnePlus',
  0x00d2: 'Dialog BLE Tag',
};

function identifyBleDeviceLabel(
  event: WebBleAdvertisingEvent,
  fallbackId: string
): { label: string; isExplicitName: boolean } {
  const shortTag = fallbackId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'BLE';

  // 1. Direct advertised device name (from Scan Response or Complete Local Name)
  const rawName = (event.name || event.device?.name || '').trim();
  if (rawName) {
    return { label: rawName, isExplicitName: true };
  }

  // 2. Check well-known Service UUIDs (WearOS, Samsung Wearable/SmartTag, Heart Rate Watch, Tile)
  const allUuids: string[] = [
    ...(event.uuids || []),
    ...(event.serviceData ? Array.from(event.serviceData.keys()) : []),
  ].map((u) => String(u).toLowerCase());

  for (const u of allUuids) {
    if (u.includes('fd5a') || u.includes('fd59')) {
      return { label: `Samsung SmartTag (${shortTag})`, isExplicitName: false };
    }
    if (u.includes('fd69') || u.includes('fee7')) {
      return { label: `Samsung Watch/Phone (${shortTag})`, isExplicitName: false };
    }
    if (u.includes('fe2c')) {
      return { label: `WearOS / Galaxy Watch (${shortTag})`, isExplicitName: false };
    }
    if (u.includes('180d') || u.includes('1826')) {
      return { label: `Smartwatch / HR (${shortTag})`, isExplicitName: false };
    }
    if (u.includes('feed') || u.includes('feec')) {
      return { label: `Tile Tracker (${shortTag})`, isExplicitName: false };
    }
  }

  // 3. Check Bluetooth SIG Manufacturer Company IDs in manufacturerData
  if (event.manufacturerData && typeof event.manufacturerData.keys === 'function') {
    for (const companyId of event.manufacturerData.keys()) {
      const brand = BLE_COMPANY_NAMES[companyId];
      if (brand) {
        return { label: `${brand} [${shortTag}]`, isExplicitName: false };
      }
      const hexId = companyId.toString(16).toUpperCase().padStart(4, '0');
      return { label: `BLE Mfg:0x${hexId} [${shortTag}]`, isExplicitName: false };
    }
  }

  // 4. Fallback to short UUID or Signal ID
  if (allUuids.length > 0) {
    const cleanUuid = allUuids[0].replace(/^0000([0-9a-f]{4})-.*$/, '$1').toUpperCase();
    return { label: `BLE Svc:${cleanUuid.slice(0, 6)} [${shortTag}]`, isExplicitName: false };
  }

  return { label: `SIG-${shortTag}`, isExplicitName: false };
}

interface BluetoothLEScan {
  active: boolean;
  stop: () => void;
}

export interface BleCapabilities {
  hasWebBluetooth: boolean;
  hasLEScan: boolean;
  isSecureContext: boolean;
  isNativeApp?: boolean;
}

export function getBleCapabilities(): BleCapabilities {
  const isNativeApp =
    typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const hasWebBluetooth =
    isNativeApp ||
    (typeof navigator !== 'undefined' && !!navigator.bluetooth);
  const hasLEScan =
    isNativeApp ||
    (hasWebBluetooth &&
      typeof navigator.bluetooth?.requestLEScan === 'function');
  const isSecureContext =
    isNativeApp ||
    (typeof window !== 'undefined' ? window.isSecureContext : false);

  return {
    hasWebBluetooth,
    hasLEScan,
    isSecureContext,
    isNativeApp,
  };
}

/**
 * Converts smoothed RSSI (dBm) to estimated distance in meters
 * using the Log-Distance Path Loss Model:
 *   d = 10 ^ ((rssiAt1m - rssi) / (10 * n))
 *
 * Note: For real smartphones/smartwatches, received RSSI at 1 meter is
 * typically around -69 dBm (whereas event.txPower in BLE packets is the
 * 0m transmit power like -8 dBm or +4 dBm, not 1m RSSI).
 */
export function rssiToDistanceMeters(
  rssi: number,
  txPower = -69,
  environment: EnvironmentPreset = 'COMPOUND'
): number {
  const n = ENVIRONMENT_CONFIG[environment].pathLossExponent;
  const effectiveRssiAt1m =
    txPower && txPower <= -45 && txPower >= -85 ? txPower : -69;
  const ratio = (effectiveRssiAt1m - rssi) / (10 * n);
  const dist = Math.pow(10, ratio);
  return Math.max(0.5, Math.min(150, Number(dist.toFixed(1))));
}

/**
 * Shortest signed angular difference (target - current) in [-180, 180]
 */
function angleDiffDeg(target: number, current: number): number {
  return ((target - current + 540) % 360) - 180;
}

export class BleRadarEngine {
  private contacts = new Map<string, BleContact>();
  private activeScan: BluetoothLEScan | null = null;
  private nativeScanning = false;
  private environment: EnvironmentPreset = 'COMPOUND';
  private currentHeadingDeg = 0;
  private whitelist = new Map<string, WhitelistedDevice>();
  private simInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private onUpdateCallback: (contacts: BleContact[]) => void;
  private boundAdvHandler: (event: Event) => void;

  constructor(onUpdate: (contacts: BleContact[]) => void) {
    this.onUpdateCallback = onUpdate;
    this.boundAdvHandler = (ev: Event) => {
      this.handleAdvertisement(ev as unknown as WebBleAdvertisingEvent);
    };

    // Prune stale passive contacts older than 60 seconds (never prune manually paired or whitelisted devices)
    this.cleanupInterval = window.setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, contact] of this.contacts.entries()) {
        if (!contact.isFriendly && !contact.simulated && now - contact.lastSeen > 60000) {
          this.contacts.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.emitUpdate();
      }
    }, 5000);
  }

  public setEnvironment(env: EnvironmentPreset) {
    this.environment = env;
    for (const contact of this.contacts.values()) {
      contact.distanceMeters = rssiToDistanceMeters(
        contact.smoothedRssi,
        contact.txPower,
        this.environment
      );
    }
    this.emitUpdate();
  }

  public setCurrentHeading(headingDeg: number) {
    this.currentHeadingDeg = ((headingDeg % 360) + 360) % 360;
  }

  public setWhitelist(list: WhitelistedDevice[]) {
    this.whitelist.clear();
    for (const item of list) {
      this.whitelist.set(item.deviceId, item);
    }
    for (const contact of this.contacts.values()) {
      const wl = this.whitelist.get(contact.id);
      const wasFriendly = contact.isFriendly;
      contact.isFriendly = !!wl;
      contact.assignedCallsign = wl?.label;
      // When newly marked as an Ally while in front of the player, snap bearing to forward heading
      if (!wasFriendly && contact.isFriendly) {
        contact.estimatedBearingDeg = this.currentHeadingDeg;
      }
    }
    this.emitUpdate();
  }

  /**
   * Manually snaps a BLE contact's direction to the direction the phone is currently pointing
   */
  public snapContactToCurrentHeading(deviceId: string) {
    const contact = this.contacts.get(deviceId);
    if (!contact) return;
    contact.estimatedBearingDeg = this.currentHeadingDeg;
    contact.arcSpreadDeg = 35;
    this.emitUpdate();
  }

  /**
   * Calibrates a BLE contact's 1-meter reference RSSI to its current smoothed RSSI
   * (when the user holds the device ~1 meter away and taps "1m CAL")
   */
  public calibrateContactAtOneMeter(deviceId: string) {
    const contact = this.contacts.get(deviceId);
    if (!contact) return;
    contact.txPower = Math.max(-85, Math.min(-45, contact.smoothedRssi));
    contact.distanceMeters = rssiToDistanceMeters(
      contact.smoothedRssi,
      contact.txPower,
      this.environment
    );
    this.emitUpdate();
  }

  /**
   * Starts continuous passive BLE advertisement scanning.
   * Uses Native Android/WearOS BluetoothLeScanner (LOW_LATENCY) when installed as an APK,
   * or Web Bluetooth `requestLEScan` in Chrome.
   */
  public async startContinuousScan(): Promise<{
    ok: boolean;
    mode: 'LE_SCAN' | 'NEEDS_FLAG' | 'ERROR';
    message: string;
  }> {
    // 1. Native Android / WearOS APK Path (Zero Chrome Flags, Full Hardware Power)
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
      try {
        await BleClient.initialize({ androidNeverForLocation: false });

        // Also query any already-connected BLE peripherals (e.g. paired Galaxy Watch / headset)
        try {
          const connected = await BleClient.getConnectedDevices([]);
          for (const dev of connected) {
            this.ingestReading({
              id: dev.deviceId,
              name: dev.name || `Connected BLE (${dev.deviceId.slice(-4)})`,
              isExplicitName: !!dev.name,
              rssi: -62,
              txPower: -69,
              simulated: false,
            });
          }
        } catch {
          // ignore if OS blocks connected list without service filter
        }

        await BleClient.requestLEScan(
          {
            allowDuplicates: true,
            scanMode: ScanMode.SCAN_MODE_LOW_LATENCY,
          },
          (result) => {
            const mfgMap = new Map<number, DataView>();
            if (result.manufacturerData) {
              for (const [k, v] of Object.entries(result.manufacturerData)) {
                const parsedId = k.startsWith('0x')
                  ? parseInt(k, 16)
                  : parseInt(k, 10);
                if (!Number.isNaN(parsedId)) {
                  mfgMap.set(parsedId, v);
                }
              }
            }

            const svcMap = new Map<string, DataView>();
            if (result.serviceData) {
              for (const [k, v] of Object.entries(result.serviceData)) {
                svcMap.set(k, v);
              }
            }

            const syntheticEvent = {
              device: {
                id: result.device.deviceId,
                name: result.localName || result.device.name,
              },
              name: result.localName || result.device.name,
              rssi: result.rssi,
              txPower: result.txPower,
              uuids: result.uuids,
              manufacturerData: mfgMap,
              serviceData: svcMap,
            } as unknown as WebBleAdvertisingEvent;

            this.handleAdvertisement(syntheticEvent);
          }
        );

        this.nativeScanning = true;
        return {
          ok: true,
          mode: 'LE_SCAN',
          message:
            'Native Hardware BLE Radar Sweep active (LOW_LATENCY • Phone & WearOS).',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          mode: 'ERROR',
          message: `Native BLE Sweep error: ${msg}`,
        };
      }
    }

    // 2. Web Browser Path
    if (!navigator.bluetooth) {
      return {
        ok: false,
        mode: 'ERROR',
        message:
          'Web Bluetooth API is not available in this browser. Use Chrome on Android/Desktop, Bluefy on iOS, or the Native APK.',
      };
    }

    if (typeof navigator.bluetooth.requestLEScan !== 'function') {
      return {
        ok: false,
        mode: 'NEEDS_FLAG',
        message:
          'Passive BLE Sweep requires enabling chrome://flags/#enable-experimental-web-platform-features in Chrome.',
      };
    }

    try {
      const scan = await navigator.bluetooth.requestLEScan({
        acceptAllAdvertisements: true,
        keepRepeatedDevices: true,
      });
      this.activeScan = scan;
      navigator.bluetooth.addEventListener?.(
        'advertisementreceived',
        this.boundAdvHandler
      );
      return {
        ok: true,
        mode: 'LE_SCAN',
        message: 'Passive BLE Radar Sweep active (all nearby advertisements).',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        mode: 'ERROR',
        message: `Passive BLE Sweep blocked or cancelled: ${msg}`,
      };
    }
  }

  /**
   * Pairs/selects a nearby BLE device via browser picker and watches its advertisements
   */
  public async scanSingleDeviceViaPicker(markAsFriendlyLabel?: string): Promise<{
    ok: boolean;
    deviceId?: string;
    deviceName?: string;
    mode: 'LE_SCAN' | 'DEVICE_WATCH' | 'ERROR';
    message: string;
  }> {
    if (!navigator.bluetooth) {
      return {
        ok: false,
        mode: 'ERROR',
        message: 'Web Bluetooth API not supported in this browser.',
      };
    }

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
      });

      const deviceId = device.id || `ble-${Math.random().toString(36).slice(2, 7)}`;
      const deviceName = device.name || `BLE-${deviceId.slice(0, 5).toUpperCase()}`;

      // Immediately seed contact straight ahead of the user's phone
      this.ingestReading({
        id: deviceId,
        name: markAsFriendlyLabel || deviceName,
        rssi: -68,
        txPower: -59,
        bearingHintDeg: this.currentHeadingDeg,
        simulated: false,
      });

      if (typeof device.watchAdvertisements === 'function') {
        device.addEventListener?.('advertisementreceived', this.boundAdvHandler);
        await device.watchAdvertisements();
      }

      return {
        ok: true,
        deviceId,
        deviceName,
        mode: 'DEVICE_WATCH',
        message: `Tracking BLE device "${deviceName}" via Web Bluetooth.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        mode: 'ERROR',
        message: `BLE selection cancelled or blocked: ${msg}`,
      };
    }
  }

  public stopScan() {
    if (this.nativeScanning) {
      this.nativeScanning = false;
      void BleClient.stopLEScan().catch(() => {
        // ignore
      });
    }
    if (this.activeScan) {
      try {
        this.activeScan.stop();
      } catch {
        // ignore
      }
      this.activeScan = null;
    }
    navigator.bluetooth?.removeEventListener?.(
      'advertisementreceived',
      this.boundAdvHandler
    );
  }

  private handleAdvertisement(event: WebBleAdvertisingEvent) {
    const id = event.device?.id || 'unknown-ble';
    const { label, isExplicitName } = identifyBleDeviceLabel(event, id);
    const rssi = typeof event.rssi === 'number' ? event.rssi : -72;
    // Note: event.txPower in BLE advertisements is 0m transmit power (-12 to +8 dBm),
    // not 1-meter reference RSSI (-69 dBm). Keep -69 dBm unless calibrated.
    const txPower = -69;

    this.ingestReading({
      id,
      name: label,
      isExplicitName,
      rssi,
      txPower,
      simulated: false,
    });
  }

  /**
   * Core Kalman/EMA filter + Directional Bearing Sector Estimator
   */
  public ingestReading(params: {
    id: string;
    name: string;
    isExplicitName?: boolean;
    rssi: number;
    txPower?: number;
    bearingHintDeg?: number;
    simulated?: boolean;
  }) {
    const {
      id,
      name,
      isExplicitName = false,
      rssi,
      txPower = -69,
      bearingHintDeg,
      simulated = false,
    } = params;
    const now = Date.now();
    const existing = this.contacts.get(id);
    const wl = this.whitelist.get(id);

    if (!existing) {
      const initialBearing =
        typeof bearingHintDeg === 'number'
          ? bearingHintDeg
          : this.currentHeadingDeg;

      const distanceMeters = rssiToDistanceMeters(rssi, txPower, this.environment);

      this.contacts.set(id, {
        id,
        name: wl?.label || name,
        rawRssi: rssi,
        smoothedRssi: rssi,
        txPower,
        distanceMeters,
        trend: 'STABLE',
        estimatedBearingDeg: ((initialBearing % 360) + 360) % 360,
        arcSpreadDeg: 85, // Initial wide proximity arc (85 degrees)
        peakRssi: rssi,
        lastSeen: now,
        isFriendly: !!wl,
        assignedCallsign: wl?.label,
        simulated,
      });
      this.emitUpdate();
      return;
    }

    // Exponential Moving Average (EMA) smoothing for RSSI
    const alpha = 0.35;
    const prevSmoothed = existing.smoothedRssi;
    const nextSmoothed = Number(
      (alpha * rssi + (1 - alpha) * prevSmoothed).toFixed(1)
    );
    const deltaRssi = nextSmoothed - prevSmoothed;

    let trend: SignalTrend = 'STABLE';
    if (deltaRssi >= 1.1) {
      trend = 'APPROACHING';
    } else if (deltaRssi <= -1.1) {
      trend = 'RECEDING';
    } else {
      trend = existing.trend;
    }

    // Update directional bearing estimate when signal strengthens while facing a heading
    let estimatedBearing = existing.estimatedBearingDeg;
    let arcSpread = existing.arcSpreadDeg;
    let peakRssi = existing.peakRssi;

    if (typeof bearingHintDeg === 'number') {
      estimatedBearing = ((bearingHintDeg % 360) + 360) % 360;
      arcSpread = Math.max(38, arcSpread - 4);
    } else if (rssi >= existing.peakRssi - 1) {
      // Nudge estimated bearing toward current compass heading when signal peaks
      const diff = angleDiffDeg(this.currentHeadingDeg, estimatedBearing);
      estimatedBearing = ((estimatedBearing + diff * 0.35) % 360 + 360) % 360;
      arcSpread = Math.max(40, existing.arcSpreadDeg - 5);
      peakRssi = Math.max(existing.peakRssi, rssi);
    } else {
      // Slightly widen uncertainty arc over time if signal weakens
      arcSpread = Math.min(95, existing.arcSpreadDeg + 1.5);
    }

    existing.rawRssi = rssi;
    existing.smoothedRssi = nextSmoothed;
    existing.distanceMeters = rssiToDistanceMeters(
      nextSmoothed,
      existing.txPower,
      this.environment
    );
    existing.trend = trend;
    existing.estimatedBearingDeg = estimatedBearing;
    existing.arcSpreadDeg = arcSpread;
    existing.peakRssi = peakRssi;
    existing.lastSeen = now;
    existing.isFriendly = !!wl;
    existing.assignedCallsign = wl?.label;
    if (wl?.label) {
      existing.name = wl.label;
    } else if (
      isExplicitName ||
      (existing.name.startsWith('SIG-') && !name.startsWith('SIG-'))
    ) {
      existing.name = name;
    }

    this.emitUpdate();
  }

  /**
   * Toggleable Field Signal Simulator for desktop testing & tactical drills
   */
  public setSimulationEnabled(enabled: boolean) {
    if (!enabled) {
      if (this.simInterval !== null) {
        clearInterval(this.simInterval);
        this.simInterval = null;
      }
      for (const [id, c] of this.contacts.entries()) {
        if (c.simulated) {
          this.contacts.delete(id);
        }
      }
      this.emitUpdate();
      return;
    }

    if (this.simInterval !== null) return;

    const simTargets = [
      {
        id: 'sim-bogey-charlie',
        name: 'TAC-BEACON-04',
        baseRssi: -75, // ~5m - 14m (straight ahead sector)
        rssiSwing: 7,
        bearingOffset: 0,
        speed: 0.65,
        phase: 0,
      },
      {
        id: 'sim-bogey-alpha',
        name: 'UNK-WATCH-7A',
        baseRssi: -81, // ~9m - 22m (front-right sector)
        rssiSwing: 9,
        bearingOffset: 38,
        speed: 0.55,
        phase: 1.8,
      },
      {
        id: 'sim-bogey-bravo',
        name: 'BLE-AUDIO-X9',
        baseRssi: -88, // ~16m - 34m (front-left sector)
        rssiSwing: 8,
        bearingOffset: 320,
        speed: 0.4,
        phase: 3.4,
      },
    ];

    const stepSim = () => {
      const t = Date.now() / 1000;
      for (const target of simTargets) {
        // Oscillate RSSI across realistic field distances (5m to 35m) in front of the player
        const wave = Math.sin(t * target.speed + target.phase) * target.rssiSwing;
        const rssi = Math.round(target.baseRssi + wave);
        const existing = this.contacts.get(target.id);
        // If user marked this simulated device as ALLY, keep its snapped bearing relative to forward
        const baseBrg = existing?.isFriendly
          ? existing.estimatedBearingDeg
          : (this.currentHeadingDeg + target.bearingOffset) % 360;
        const driftBearing = existing?.isFriendly
          ? baseBrg
          : (baseBrg + Math.sin(t * 0.25 + target.phase) * 15 + 360) % 360;

        this.ingestReading({
          id: target.id,
          name: target.name,
          rssi,
          txPower: -59,
          bearingHintDeg: driftBearing,
          simulated: true,
        });
      }
    };

    stepSim();
    this.simInterval = window.setInterval(stepSim, 1400);
  }

  public destroy() {
    this.stopScan();
    if (this.simInterval !== null) clearInterval(this.simInterval);
    if (this.cleanupInterval !== null) clearInterval(this.cleanupInterval);
  }

  private emitUpdate() {
    const sorted = Array.from(this.contacts.values()).sort(
      (a, b) => a.distanceMeters - b.distanceMeters
    );
    this.onUpdateCallback(sorted);
  }
}
