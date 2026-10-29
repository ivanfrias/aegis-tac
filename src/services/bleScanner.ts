import {
  BleContact,
  ENVIRONMENT_CONFIG,
  EnvironmentPreset,
  SignalTrend,
  WhitelistedDevice,
} from '../types/radar';

// Web Bluetooth Experimental Type Definitions
interface BluetoothAdvertisingEvent extends Event {
  device: {
    id: string;
    name?: string;
    watchAdvertisements?: () => Promise<void>;
  };
  rssi?: number;
  txPower?: number;
  uuids?: string[];
  manufacturerData?: Map<number, DataView>;
}

interface BluetoothLEScan {
  active: boolean;
  stop: () => void;
}

declare global {
  interface Navigator {
    bluetooth?: {
      requestDevice: (options: {
        acceptAllDevices?: boolean;
        filters?: Array<Record<string, unknown>>;
        optionalServices?: string[];
      }) => Promise<{
        id: string;
        name?: string;
        watchAdvertisements?: () => Promise<void>;
        addEventListener?: (
          type: string,
          listener: (event: BluetoothAdvertisingEvent) => void
        ) => void;
      }>;
      requestLEScan?: (options: {
        acceptAllAdvertisements?: boolean;
        keepRepeatedDevices?: boolean;
      }) => Promise<BluetoothLEScan>;
      addEventListener?: (
        type: string,
        listener: (event: BluetoothAdvertisingEvent) => void
      ) => void;
      removeEventListener?: (
        type: string,
        listener: (event: BluetoothAdvertisingEvent) => void
      ) => void;
    };
  }
}

export interface BleCapabilities {
  hasWebBluetooth: boolean;
  hasLEScan: boolean;
  isSecureContext: boolean;
}

export function getBleCapabilities(): BleCapabilities {
  const hasWebBluetooth = typeof navigator !== 'undefined' && !!navigator.bluetooth;
  const hasLEScan =
    hasWebBluetooth && typeof navigator.bluetooth?.requestLEScan === 'function';
  const isSecureContext =
    typeof window !== 'undefined' ? window.isSecureContext : false;

  return {
    hasWebBluetooth,
    hasLEScan,
    isSecureContext,
  };
}

/**
 * Converts smoothed RSSI (dBm) to estimated distance in meters
 * using the Log-Distance Path Loss Model:
 *   d = 10 ^ ((txPower - rssi) / (10 * n))
 */
export function rssiToDistanceMeters(
  rssi: number,
  txPower = -59,
  environment: EnvironmentPreset = 'COMPOUND'
): number {
  const n = ENVIRONMENT_CONFIG[environment].pathLossExponent;
  const effectiveTx = txPower && txPower < 0 ? txPower : -59;
  const ratio = (effectiveTx - rssi) / (10 * n);
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
  private environment: EnvironmentPreset = 'COMPOUND';
  private currentHeadingDeg = 0;
  private whitelist = new Map<string, WhitelistedDevice>();
  private simInterval: number | null = null;
  private cleanupInterval: number | null = null;
  private onUpdateCallback: (contacts: BleContact[]) => void;
  private boundAdvHandler: (event: BluetoothAdvertisingEvent) => void;

  constructor(onUpdate: (contacts: BleContact[]) => void) {
    this.onUpdateCallback = onUpdate;
    this.boundAdvHandler = this.handleAdvertisement.bind(this);

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
   * Starts continuous Web Bluetooth passive advertisement scanning (`requestLEScan`)
   */
  public async startContinuousScan(): Promise<{
    ok: boolean;
    mode: 'LE_SCAN' | 'DEVICE_WATCH' | 'ERROR';
    message: string;
  }> {
    if (!navigator.bluetooth) {
      return {
        ok: false,
        mode: 'ERROR',
        message:
          'Web Bluetooth API is not available in this browser. Use Chrome on Android/Desktop or Bluefy on iOS.',
      };
    }

    // 1. Try continuous passive LE scan first
    if (typeof navigator.bluetooth.requestLEScan === 'function') {
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
        // Fall through to requestDevice + watchAdvertisements if user or flag blocked requestLEScan
        console.warn('requestLEScan failed, attempting device picker fallback:', msg);
      }
    }

    // 2. Fallback: requestDevice + watchAdvertisements
    return this.scanSingleDeviceViaPicker();
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

  private handleAdvertisement(event: BluetoothAdvertisingEvent) {
    const id = event.device?.id || 'unknown-ble';
    const name =
      event.device?.name ||
      (event.uuids && event.uuids.length > 0
        ? `UUID:${event.uuids[0].slice(0, 6)}`
        : `SIG-${id.slice(0, 5).toUpperCase()}`);
    const rssi = typeof event.rssi === 'number' ? event.rssi : -72;
    const txPower = typeof event.txPower === 'number' ? event.txPower : -59;

    this.ingestReading({
      id,
      name,
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
    rssi: number;
    txPower?: number;
    bearingHintDeg?: number;
    simulated?: boolean;
  }) {
    const { id, name, rssi, txPower = -59, bearingHintDeg, simulated = false } = params;
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
