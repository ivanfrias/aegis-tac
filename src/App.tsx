import React, { useEffect, useRef, useState } from 'react';
import {
  Radar,
  Bluetooth,
  Users,
  Sliders,
  Navigation,
  Volume2,
  VolumeX,
  Shield,
  Skull,
  HeartPulse,
  Crosshair,
  AlertTriangle,
  Flag,
  Radio,
  Map as MapIcon,
  Compass,
  Eye,
  Wrench,
  HelpCircle,
  Trash2,
  X,
  Watch,
  Download,
} from 'lucide-react';
import {
  BleContact,
  ENVIRONMENT_CONFIG,
  EnvironmentPreset,
  PingType,
  PlayerStatus,
  SquadMember,
  TacticalPing,
  WhitelistedDevice,
} from './types/radar';
import {
  BleRadarEngine,
  getBleCapabilities,
} from './services/bleScanner';
import {
  projectGpsCoordinate,
  requestCompassPermissionIfNeeded,
} from './services/orientation';
import {
  SquadConnectionStatus,
  SquadP2PService,
} from './services/squadP2P';
import { RadarDisplay } from './components/RadarDisplay';
import { TacticalControls } from './components/TacticalControls';
import { BleContactsList } from './components/BleContactsList';
import { SquadPanel } from './components/SquadPanel';
import { FieldManualModal } from './components/FieldManualModal';
import { WatchHud } from './components/WatchHud';

export type ScreenMode = 'BASIC' | 'WATCH' | 'ADVANCED';

export const App: React.FC = () => {
  const [screenMode, setScreenMode] = useState<ScreenMode>(() => {
    if (
      typeof window !== 'undefined' &&
      (window.innerWidth <= 290 || window.innerHeight <= 290)
    ) {
      return 'WATCH';
    }
    return 'BASIC';
  });
  const [showManual, setShowManual] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aegistac_onboarded_v1') !== 'true';
    } catch {
      return false;
    }
  });

  const handleCloseManual = () => {
    try {
      localStorage.setItem('aegistac_onboarded_v1', 'true');
    } catch {
      // ignore
    }
    setShowManual(false);
  };

  const [selfPeerId] = useState(
    () => `op-${Math.random().toString(36).slice(2, 8)}`
  );
  const [callsign, setCallsign] = useState(
    () => `ALPHA-${Math.floor(1 + Math.random() * 9)}`
  );
  const [roomCode, setRoomCode] = useState('ECHO-4');
  const [squadPin, setSquadPin] = useState('0451');
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('ACTIVE');

  // Radar & Environment Settings
  const [environment, setEnvironment] = useState<EnvironmentPreset>('COMPOUND');
  const [maxRangeMeters, setMaxRangeMeters] = useState<number>(40);
  const [headUpMode, setHeadUpMode] = useState<boolean>(true);
  const [showSatellite, setShowSatellite] = useState<boolean>(true);
  const [mapStyle, setMapStyle] = useState<'SATELLITE' | 'TOPO'>('SATELLITE');
  const [activePingTool, setActivePingTool] = useState<PingType | null>(null);
  const [audioAlerts, setAudioAlerts] = useState<boolean>(true);
  const [advTab, setAdvTab] = useState<'BLE' | 'SQUAD' | 'CALIBRATE'>('BLE');

  // Sensors (GPS + Compass)
  const [selfLat, setSelfLat] = useState<number | null>(null);
  const [selfLng, setSelfLng] = useState<number | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number>(0);
  const [hasCompassLock, setHasCompassLock] = useState<boolean>(false);
  const [hasGpsLock, setHasGpsLock] = useState<boolean>(false);

  // BLE State (Simulator OFF by default so real field use starts clean)
  const [contacts, setContacts] = useState<BleContact[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistedDevice[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [simEnabled, setSimEnabled] = useState<boolean>(false);
  const [bleOnlyMode, setBleOnlyMode] = useState<boolean>(false);
  const [showBleFlagModal, setShowBleFlagModal] = useState<boolean>(false);
  const [showApkModal, setShowApkModal] = useState<boolean>(false);
  const [copiedFlag, setCopiedFlag] = useState<boolean>(false);
  const [scanStatusText, setScanStatusText] = useState<string>(
    'Ready. Tap SCAN / BLE SWEEP for live Bluetooth, or SIM: ON to test.'
  );

  // Squad P2P State
  const [squadStatus, setSquadStatus] =
    useState<SquadConnectionStatus>('DISCONNECTED');
  const [squadInfo, setSquadInfo] = useState<string>(
    'Ready to link via WebRTC P2P'
  );
  const [squadMembers, setSquadMembers] = useState<SquadMember[]>([]);
  const [pings, setPings] = useState<TacticalPing[]>([]);

  const bleEngineRef = useRef<BleRadarEngine | null>(null);
  const p2pRef = useRef<SquadP2PService | null>(null);
  const capabilities = getBleCapabilities();

  const playTacticalTone = (freq = 880, durationMs = 90) => {
    if (!audioAlerts) return;
    try {
      navigator.vibrate?.(Math.min(220, durationMs));
    } catch {
      // ignore
    }
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        ctx.close();
      }, durationMs);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const engine = new BleRadarEngine((updatedContacts) => {
      setContacts(updatedContacts);
    });
    engine.setSimulationEnabled(false);
    bleEngineRef.current = engine;

    const initialSelf: SquadMember = {
      peerId: selfPeerId,
      callsign,
      status: 'ACTIVE',
      lat: null,
      lng: null,
      heading: 0,
      bleDeviceIds: [],
      lastUpdated: Date.now(),
    };

    const p2p = new SquadP2PService(initialSelf, {
      onStatusChange: (st, info) => {
        setSquadStatus(st);
        if (info) setSquadInfo(info);
      },
      onRosterChange: (members) => {
        setSquadMembers(members);
      },
      onWhitelistChange: (wl) => {
        setWhitelist(wl);
        bleEngineRef.current?.setWhitelist(wl);
      },
      onPingsChange: (updatedPings) => {
        setPings(updatedPings);
      },
    });
    p2pRef.current = p2p;

    const leftPreviously =
      typeof window !== 'undefined' &&
      window.sessionStorage.getItem('aegistac_squad_left') === '1';

    if (!leftPreviously) {
      void p2p.connectToRoom(roomCode, callsign, squadPin);
    } else {
      setSquadStatus('DISCONNECTED');
      setSquadInfo('Offline / Solo Mode — Enter Room & PIN to join a squad');
    }

    const pingPruneTimer = window.setInterval(() => {
      p2p.pruneExpiredPings();
    }, 1000);

    return () => {
      clearInterval(pingPruneTimer);
      engine.destroy();
      void p2p.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    let smoothedLat: number | null = null;
    let smoothedLng: number | null = null;
    let fallbackWatchId: number | null = null;

    const applyGpsFix = (pos: GeolocationPosition) => {
      const rawLat = pos.coords.latitude;
      const rawLng = pos.coords.longitude;
      const acc = pos.coords.accuracy || 15;

      // Smooth indoor GPS multipath jitter while keeping outdoor movement responsive
      if (smoothedLat === null || smoothedLng === null || acc <= 8) {
        smoothedLat = rawLat;
        smoothedLng = rawLng;
      } else {
        const alpha = 0.4;
        smoothedLat = alpha * rawLat + (1 - alpha) * smoothedLat;
        smoothedLng = alpha * rawLng + (1 - alpha) * smoothedLng;
      }

      setSelfLat(smoothedLat);
      setSelfLng(smoothedLng);
      setHasGpsLock(true);
      p2pRef.current?.updateSelfState({
        lat: smoothedLat,
        lng: smoothedLng,
      });
    };

    // 1. Grab an immediate coarse/fused position so indoor devices never hang at null (18m default)
    navigator.geolocation.getCurrentPosition(
      applyGpsFix,
      () => {
        // ignore initial coarse error; watchPosition will handle it
      },
      {
        enableHighAccuracy: false,
        maximumAge: 30000,
        timeout: 10000,
      }
    );

    // 2. Continuous high-accuracy watch with automatic indoor fused fallback on timeout
    const watchId = navigator.geolocation.watchPosition(
      applyGpsFix,
      () => {
        if (fallbackWatchId === null) {
          fallbackWatchId = navigator.geolocation.watchPosition(
            applyGpsFix,
            () => {
              if (smoothedLat === null) setHasGpsLock(false);
            },
            {
              enableHighAccuracy: false,
              maximumAge: 10000,
              timeout: 15000,
            }
          );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      if (fallbackWatchId !== null) {
        navigator.geolocation.clearWatch(fallbackWatchId);
      }
    };
  }, []);

  useEffect(() => {
    let lastUiUpdate = 0;
    let lastP2PUpdate = 0;
    let hasAbsoluteLock = false;

    const processHeading = (heading: number) => {
      const now = Date.now();
      bleEngineRef.current?.setCurrentHeading(heading);

      if (now - lastUiUpdate > 50) {
        lastUiUpdate = now;
        setHeadingDeg(heading);
        setHasCompassLock(true);
      }

      if (now - lastP2PUpdate > 600) {
        lastP2PUpdate = now;
        p2pRef.current?.updateSelfState({ heading });
      }
    };

    // 1. Prefer deviceorientationabsolute on Android so 0° = True Magnetic North (never 180° inverted)
    const handleAbsoluteOrientation = (ev: Event) => {
      const devEv = ev as DeviceOrientationEvent;
      if (typeof devEv.alpha === 'number' && Number.isFinite(devEv.alpha)) {
        hasAbsoluteLock = true;
        const heading = ((360 - devEv.alpha) % 360 + 360) % 360;
        processHeading(heading);
      }
    };

    // 2. Fallback for iOS (webkitCompassHeading) or devices without deviceorientationabsolute
    const handleStandardOrientation = (ev: DeviceOrientationEvent) => {
      const webkitCompass = (
        ev as unknown as { webkitCompassHeading?: number }
      ).webkitCompassHeading;

      if (typeof webkitCompass === 'number' && Number.isFinite(webkitCompass)) {
        processHeading(((webkitCompass % 360) + 360) % 360);
      } else if (
        !hasAbsoluteLock &&
        typeof ev.alpha === 'number' &&
        Number.isFinite(ev.alpha)
      ) {
        processHeading(((360 - ev.alpha) % 360 + 360) % 360);
      }
    };

    window.addEventListener(
      'deviceorientationabsolute',
      handleAbsoluteOrientation,
      true
    );
    window.addEventListener(
      'deviceorientation',
      handleStandardOrientation,
      true
    );
    return () => {
      window.removeEventListener(
        'deviceorientationabsolute',
        handleAbsoluteOrientation,
        true
      );
      window.removeEventListener(
        'deviceorientation',
        handleStandardOrientation,
        true
      );
    };
  }, []);

  const handleStartPassiveScan = async () => {
    if (!bleEngineRef.current) return;
    const res = await bleEngineRef.current.startContinuousScan();
    setScanStatusText(res.message);
    if (res.ok) {
      setIsScanning(true);
      playTacticalTone(1040, 80);
    } else if (res.mode === 'NEEDS_FLAG') {
      setShowBleFlagModal(true);
      playTacticalTone(520, 90);
    }
  };

  const handleStopScan = () => {
    bleEngineRef.current?.stopScan();
    setIsScanning(false);
    setScanStatusText('Live BLE sweep paused.');
  };

  const handlePickDevice = async () => {
    if (!bleEngineRef.current) return;
    const res = await bleEngineRef.current.scanSingleDeviceViaPicker();
    setScanStatusText(res.message);
    if (res.ok && res.deviceId) {
      playTacticalTone(1200, 90);
    }
  };

  const handleToggleSimulation = (enabled: boolean) => {
    setSimEnabled(enabled);
    bleEngineRef.current?.setSimulationEnabled(enabled);
    setScanStatusText(
      enabled
        ? 'Field Simulator enabled (3 synthetic BLE contacts).'
        : 'Field Simulator off.'
    );
  };

  const handleWhitelistContact = (contact: BleContact) => {
    const entry: WhitelistedDevice = {
      deviceId: contact.id,
      label: `ALLY-${contact.name.slice(0, 7)}`,
      addedBy: callsign,
    };
    const nextWl = [
      ...whitelist.filter((w) => w.deviceId !== contact.id),
      entry,
    ];
    setWhitelist(nextWl);
    bleEngineRef.current?.setWhitelist(nextWl);
    p2pRef.current?.addWhitelistedDevice(entry);
    playTacticalTone(980, 70);
  };

  const handleRemoveWhitelist = (deviceId: string) => {
    const nextWl = whitelist.filter((w) => w.deviceId !== deviceId);
    setWhitelist(nextWl);
    bleEngineRef.current?.setWhitelist(nextWl);
    p2pRef.current?.removeWhitelistedDevice(deviceId);
  };

  const handleStatusChange = (nextStatus: PlayerStatus) => {
    setPlayerStatus(nextStatus);
    p2pRef.current?.updateSelfState({ status: nextStatus });
    if (nextStatus === 'MEDIC') {
      playTacticalTone(520, 220);
    } else {
      playTacticalTone(780, 60);
    }
  };

  const handleEnvironmentChange = (env: EnvironmentPreset) => {
    setEnvironment(env);
    const defaultRange = ENVIRONMENT_CONFIG[env].defaultRangeMeters;
    setMaxRangeMeters(defaultRange);
    bleEngineRef.current?.setEnvironment(env);
  };

  const createAndBroadcastPing = (
    type: PingType,
    bearingDeg: number,
    distanceMeters: number
  ) => {
    const now = Date.now();
    let pingLat: number | null = null;
    let pingLng: number | null = null;

    if (selfLat !== null && selfLng !== null) {
      const projected = projectGpsCoordinate(
        selfLat,
        selfLng,
        bearingDeg,
        distanceMeters
      );
      pingLat = projected.lat;
      pingLng = projected.lng;
    }

    const ping: TacticalPing = {
      id: `ping-${now}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      senderCallsign: callsign,
      lat: pingLat,
      lng: pingLng,
      bearingDeg,
      distanceMeters,
      createdAt: now,
      expiresAt: now + 3600000 * 6, // Persist until manually cleared (up to 6 hours)
    };

    p2pRef.current?.sendTacticalPing(ping);
    playTacticalTone(type === 'ENEMY' ? 1320 : 920, 110);
  };

  const handleRadarTapPing = (bearingDeg: number, distanceMeters: number) => {
    if (!activePingTool) return;
    createAndBroadcastPing(activePingTool, bearingDeg, distanceMeters);
    setActivePingTool(null);
  };

  const handleQuickPingAhead = (type: PingType) => {
    createAndBroadcastPing(type, Math.round(headingDeg), 20);
  };

  const handleRemovePing = (pingId: string) => {
    p2pRef.current?.removeTacticalPing(pingId);
    playTacticalTone(640, 50);
  };

  const handleClearAllPings = () => {
    p2pRef.current?.clearAllPings();
    setActivePingTool(null);
    playTacticalTone(580, 70);
  };

  const handleBasicPingClick = (type: PingType) => {
    if (activePingTool === type) {
      handleQuickPingAhead(type);
      setActivePingTool(null);
    } else {
      setActivePingTool(type);
    }
  };

  const handleManualHeadingChange = (deg: number) => {
    setHeadingDeg(deg);
    bleEngineRef.current?.setCurrentHeading(deg);
    p2pRef.current?.updateSelfState({ heading: deg });
  };

  const handleEnableCompassSensor = async () => {
    const granted = await requestCompassPermissionIfNeeded();
    if (granted) {
      setScanStatusText('Compass orientation sensor permission granted.');
    }
  };

  const handleAddSimulatedTeammate = () => {
    const baseLat = selfLat ?? 37.7749;
    const baseLng = selfLng ?? -122.4194;
    const randomBearing = Math.floor(Math.random() * 360);
    const randomDist = Math.floor(10 + Math.random() * 22);
    const coords = projectGpsCoordinate(
      baseLat,
      baseLng,
      randomBearing,
      randomDist
    );

    const simId = `sim-mate-${Math.random().toString(36).slice(2, 6)}`;
    const states: PlayerStatus[] = ['ACTIVE', 'ACTIVE', 'MEDIC'];
    const pickedStatus = states[Math.floor(Math.random() * states.length)];

    const mate: SquadMember = {
      peerId: simId,
      callsign: `BRAVO-${Math.floor(2 + Math.random() * 8)}`,
      status: pickedStatus,
      lat: coords.lat,
      lng: coords.lng,
      heading: randomBearing,
      bleDeviceIds: [],
      lastUpdated: Date.now(),
    };

    if (selfLat === null) {
      setSelfLat(baseLat);
      setSelfLng(baseLng);
    }

    p2pRef.current?.addSimulatedMember(mate);
    playTacticalTone(940, 80);
  };

  const bogeyCount = contacts.filter((c) => !c.isFriendly).length;
  const closestBogey = contacts.find((c) => !c.isFriendly);

  return (
    <div className="min-h-dvh w-full bg-[#050b07] text-emerald-100 flex flex-col select-none">
      {/* Top Telemetry Bar */}
      <header className="sticky top-0 z-30 bg-[#07120c]/95 backdrop-blur border-b border-emerald-500/25 px-3 py-2 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Radar
                className="w-3.5 h-3.5 text-emerald-400 animate-spin"
                style={{ animationDuration: '6s' }}
              />
            </div>
            <div className="min-w-0">
              <div className="font-mono text-xs font-extrabold tracking-wider text-emerald-300 flex items-center gap-1.5 truncate">
                <span className="truncate">AEGISTAC</span>
                <span className="text-[10px] bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 rounded text-emerald-200 shrink-0">
                  {callsign}
                </span>
              </div>
              <div className="text-[10px] font-mono text-emerald-400/70 flex items-center gap-1.5 truncate">
                <span>HDG {Math.round(headingDeg)}°</span>
                <span>•</span>
                {squadStatus === 'DISCONNECTED' ? (
                  <span className="text-zinc-400">SOLO (OFFLINE)</span>
                ) : (
                  <span className="flex items-center gap-1">
                    <span>ROOM: {roomCode}</span>
                    <button
                      onClick={() => {
                        try {
                          window.sessionStorage.setItem('aegistac_squad_left', '1');
                        } catch {
                          // ignore
                        }
                        void p2pRef.current?.disconnect();
                        playTacticalTone(520, 60);
                      }}
                      className="text-[9px] px-1 py-0.2 rounded bg-red-900/70 hover:bg-red-700 text-red-200 border border-red-500/50 font-bold cursor-pointer"
                      title="Leave current squad room"
                    >
                      EXIT
                    </button>
                  </span>
                )}
                <span>•</span>
                <span>SCALE: {maxRangeMeters}m</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowApkModal(true)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/60 text-cyan-200 font-mono text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Download Android / WearOS APK or Install Web App"
            >
              <Download className="w-3.5 h-3.5 text-cyan-300" />
              <span>APK</span>
            </button>

            <button
              onClick={() => setShowManual(true)}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 font-mono text-xs font-bold flex items-center gap-1 cursor-pointer"
              title="Open Onboarding Guide & Button Reference"
            >
              <HelpCircle className="w-3.5 h-3.5 text-emerald-300" />
              <span>GUIDE</span>
            </button>

            <button
              onClick={() => setAudioAlerts((v) => !v)}
              className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 hover:text-emerald-100 cursor-pointer shrink-0"
              title="Toggle Audio Alerts"
            >
              {audioAlerts ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4 text-zinc-500" />
              )}
            </button>
          </div>
        </div>

        {/* Full-Width Prominent Screen Switcher: BASIC vs WATCH vs ADVANCED */}
        <div className="grid grid-cols-3 gap-1.5 bg-black/70 p-1 rounded-xl border border-emerald-500/35">
          <button
            onClick={() => setScreenMode('BASIC')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-mono text-xs font-extrabold tracking-wide transition cursor-pointer ${
              screenMode === 'BASIC'
                ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.45)]'
                : 'text-emerald-300/75 hover:text-emerald-200 bg-emerald-950/25'
            }`}
          >
            <Eye className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">BASIC HUD</span>
          </button>

          <button
            onClick={() => setScreenMode('WATCH')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-mono text-xs font-extrabold tracking-wide transition cursor-pointer ${
              screenMode === 'WATCH'
                ? 'bg-amber-400 text-black shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                : 'text-amber-300/80 hover:text-amber-200 bg-amber-950/25'
            }`}
            title="Full-Screen Circular Smartwatch HUD (Galaxy Watch / WearOS)"
          >
            <Watch className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">WATCH HUD</span>
          </button>

          <button
            onClick={() => setScreenMode('ADVANCED')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg font-mono text-xs font-extrabold tracking-wide transition cursor-pointer ${
              screenMode === 'ADVANCED'
                ? 'bg-cyan-400 text-black shadow-[0_0_12px_rgba(34,211,238,0.45)]'
                : 'text-emerald-300/75 hover:text-emerald-200 bg-emerald-950/25'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ADVANCED ({bogeyCount})</span>
          </button>
        </div>
      </header>

      {screenMode === 'WATCH' ? (
        <WatchHud
          contacts={contacts}
          squadMembers={squadMembers}
          selfPeerId={selfPeerId}
          pings={pings}
          selfLat={selfLat}
          selfLng={selfLng}
          headingDeg={headingDeg}
          maxRangeMeters={maxRangeMeters}
          headUpMode={headUpMode}
          showSatellite={showSatellite}
          mapStyle={mapStyle}
          activePingTool={activePingTool}
          isScanning={isScanning}
          simEnabled={simEnabled}
          bleOnlyMode={bleOnlyMode}
          playerStatus={playerStatus}
          onStartScan={handleStartPassiveScan}
          onStopScan={handleStopScan}
          onToggleSim={() => handleToggleSimulation(!simEnabled)}
          onToggleBleOnly={() => setBleOnlyMode((v) => !v)}
          onCycleRange={() => {
            const scales = [20, 40, 75, 120];
            const next =
              scales[(scales.indexOf(maxRangeMeters) + 1) % scales.length];
            setMaxRangeMeters(next);
          }}
          onToggleHeadUp={() => setHeadUpMode((v) => !v)}
          onCycleStatus={() => {
            const order: PlayerStatus[] = ['ACTIVE', 'HIT', 'MEDIC'];
            const next =
              order[(order.indexOf(playerStatus) + 1) % order.length];
            handleStatusChange(next);
          }}
          onEnemyPingTap={() => handleBasicPingClick('ENEMY')}
          onRadarTapPing={handleRadarTapPing}
          onRemovePing={handleRemovePing}
          onClearAllPings={handleClearAllPings}
          onExitWatchMode={() => setScreenMode('BASIC')}
        />
      ) : screenMode === 'BASIC' ? (
        <main className="flex-1 w-full max-w-md mx-auto px-3 py-2 flex flex-col justify-between gap-2">
          {/* Top Threat Proximity Strip + Quick Map/Range Pills */}
          <div className="flex items-center justify-between gap-2">
            {closestBogey ? (
              <div
                className={`flex-1 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border flex items-center justify-between ${
                  closestBogey.distanceMeters <= 12
                    ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse'
                    : 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-current" />
                  <span>BOGEY DETECTED</span>
                </span>
                <span className="text-sm font-extrabold">
                  {closestBogey.distanceMeters}m{' '}
                  {closestBogey.trend === 'APPROACHING' ? '▲' : ''}
                </span>
              </div>
            ) : (
              <div className="flex-1 px-3 py-1.5 rounded-xl font-mono text-xs font-bold bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 flex items-center justify-between">
                <span>SECTOR CLEAR</span>
                <span className="text-[10px] opacity-75">
                  {squadMembers.length} SQUAD
                </span>
              </div>
            )}

            {/* Quick 1-Tap BLE Sweep Toggle + Simulator Toggle */}
            <button
              onClick={isScanning ? handleStopScan : handleStartPassiveScan}
              className={`px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-bold border flex items-center gap-1 shrink-0 cursor-pointer ${
                isScanning
                  ? 'bg-red-600/80 border-red-400 text-white'
                  : 'bg-emerald-600 border-emerald-300 text-black'
              }`}
            >
              <Radio
                className={`w-3.5 h-3.5 ${isScanning ? 'animate-ping' : ''}`}
              />
              <span>{isScanning ? 'LIVE' : 'SCAN'}</span>
            </button>

            <button
              onClick={() => handleToggleSimulation(!simEnabled)}
              className={`px-2.5 py-1.5 rounded-xl font-mono text-[11px] font-bold border shrink-0 cursor-pointer transition ${
                simEnabled
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                  : 'bg-black/50 border-emerald-500/30 text-emerald-300/75 hover:text-emerald-200'
              }`}
              title="Toggle Field Signal Simulator On/Off"
            >
              {simEnabled ? 'SIM: ON' : 'SIM: OFF'}
            </button>
          </div>

          {/* Centerpiece: 360° Tactical Radar + Floating Quick Toggles */}
          <div className="relative flex-1 flex flex-col items-center justify-center min-h-0">
            <div className="w-full max-w-[310px] sm:max-w-[360px] mx-auto">
              <RadarDisplay
                contacts={contacts}
                squadMembers={bleOnlyMode ? [] : squadMembers}
                selfPeerId={selfPeerId}
                pings={pings}
                selfLat={selfLat}
                selfLng={selfLng}
                headingDeg={headingDeg}
                maxRangeMeters={maxRangeMeters}
                headUpMode={headUpMode}
                showSatellite={showSatellite}
                mapStyle={mapStyle}
                activePingTool={activePingTool}
                onRadarTapPing={handleRadarTapPing}
                onRemovePing={handleRemovePing}
              />
            </div>

            {/* Quick Corner Pills under Radar (Map, Compass, Range Cycle, BLE Only) */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[10px] font-mono">
              <button
                onClick={() => setShowSatellite((v) => !v)}
                className={`px-2 py-0.5 rounded border flex items-center gap-1 cursor-pointer ${
                  showSatellite
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200'
                    : 'bg-black/40 border-emerald-500/20 text-emerald-400/60'
                }`}
              >
                <MapIcon className="w-3 h-3" />
                <span>{showSatellite ? 'MAP ON' : 'MAP OFF'}</span>
              </button>

              <button
                onClick={() => setHeadUpMode((v) => !v)}
                className="px-2 py-0.5 rounded border bg-black/40 border-emerald-500/25 text-emerald-300 flex items-center gap-1 cursor-pointer"
              >
                <Compass className="w-3 h-3" />
                <span>{headUpMode ? 'HEAD-UP' : 'NORTH-UP'}</span>
              </button>

              <button
                onClick={() => {
                  const scales = [20, 40, 75, 120];
                  const next =
                    scales[(scales.indexOf(maxRangeMeters) + 1) % scales.length];
                  setMaxRangeMeters(next);
                }}
                className="px-2 py-0.5 rounded border bg-emerald-500/20 border-emerald-400/50 text-emerald-200 font-bold cursor-pointer"
              >
                RANGE: {maxRangeMeters}m
              </button>

              <button
                onClick={() => setBleOnlyMode((v) => !v)}
                className={`px-2 py-0.5 rounded border flex items-center gap-1 font-bold cursor-pointer transition ${
                  bleOnlyMode
                    ? 'bg-cyan-400 text-black border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                    : 'bg-black/40 border-cyan-500/30 text-cyan-300/80 hover:text-cyan-200'
                }`}
                title="Toggle Bluetooth-Only radar mode (hides Squad GPS dots)"
              >
                <Bluetooth className="w-3 h-3" />
                <span>{bleOnlyMode ? 'BLE ONLY: ON' : 'BLE ONLY'}</span>
              </button>
            </div>
          </div>

          {/* Bottom Dock: Large Glove-Friendly Status & Quick Ping Buttons */}
          <div className="bg-[#08140e]/95 border border-emerald-500/25 rounded-2xl p-2.5 flex flex-col gap-2">
            {/* Status Row */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleStatusChange('ACTIVE')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                  playerStatus === 'ACTIVE'
                    ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                    : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <Shield className="w-4 h-4 shrink-0" />
                <span>IN PLAY</span>
              </button>

              <button
                onClick={() => handleStatusChange('HIT')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                  playerStatus === 'HIT'
                    ? 'bg-zinc-200 text-black border-white shadow'
                    : 'bg-zinc-900/80 text-zinc-300 border-zinc-600/40'
                }`}
              >
                <Skull className="w-4 h-4 shrink-0" />
                <span>HIT / OUT</span>
              </button>

              <button
                onClick={() => handleStatusChange('MEDIC')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                  playerStatus === 'MEDIC'
                    ? 'bg-red-600 text-white border-red-300 animate-pulse shadow-[0_0_14px_rgba(239,68,68,0.7)]'
                    : 'bg-red-950/50 text-red-300 border-red-500/40'
                }`}
              >
                <HeartPulse className="w-4 h-4 shrink-0" />
                <span>MEDIC!</span>
              </button>
            </div>

            {/* Quick Ping Row */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleBasicPingClick('ENEMY')}
                className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                  activePingTool === 'ENEMY'
                    ? 'bg-red-600 text-white border-red-200 animate-pulse'
                    : 'bg-red-950/40 text-red-300 border-red-500/35'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5 shrink-0" />
                <span>! ENEMY</span>
              </button>

              <button
                onClick={() => handleBasicPingClick('DANGER')}
                className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                  activePingTool === 'DANGER'
                    ? 'bg-orange-500 text-black border-orange-200 animate-pulse'
                    : 'bg-orange-950/40 text-orange-300 border-orange-500/35'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>! DANGER</span>
              </button>

              <button
                onClick={() => handleBasicPingClick('OBJECTIVE')}
                className={`flex items-center justify-center gap-1 py-2 px-2 rounded-xl font-mono text-xs font-bold border transition cursor-pointer ${
                  activePingTool === 'OBJECTIVE'
                    ? 'bg-yellow-400 text-black border-yellow-100 animate-pulse'
                    : 'bg-yellow-950/40 text-yellow-300 border-yellow-500/35'
                }`}
              >
                <Flag className="w-3.5 h-3.5 shrink-0" />
                <span>! OBJ</span>
              </button>
            </div>

            {/* Active Pings Dismiss & Clear Row (appears whenever pings are on radar) */}
            {pings.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-emerald-500/20">
                <div className="flex flex-wrap items-center gap-1">
                  {pings.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleRemovePing(p.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 font-mono text-[10px] font-bold cursor-pointer"
                      title="Tap to remove this ping"
                    >
                      <span>
                        {p.type} {p.distanceMeters}m
                      </span>
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleClearAllPings}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-mono text-[10px] font-bold cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>CLEAR PINGS</span>
                </button>
              </div>
            )}
          </div>
        </main>
      ) : (
        /* ===================================================================
           SCREEN 2: ADVANCED / COMMAND & SETUP (BLE Inspector, Squad E2EE, Calibration)
           =================================================================== */
        <main className="flex-1 w-full max-w-6xl mx-auto px-2.5 py-2 grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
          {/* Left Column (Visible alongside controls on Desktop, or compact header on Mobile) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center w-full">
            <div className="w-full max-w-[230px] sm:max-w-[300px] lg:max-w-[360px] mx-auto">
              <RadarDisplay
                contacts={contacts}
                squadMembers={bleOnlyMode ? [] : squadMembers}
                selfPeerId={selfPeerId}
                pings={pings}
                selfLat={selfLat}
                selfLng={selfLng}
                headingDeg={headingDeg}
                maxRangeMeters={maxRangeMeters}
                headUpMode={headUpMode}
                showSatellite={showSatellite}
                mapStyle={mapStyle}
                activePingTool={activePingTool}
                onRadarTapPing={handleRadarTapPing}
                onRemovePing={handleRemovePing}
              />
            </div>

            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[10px] font-mono text-emerald-300/80">
              <span className="flex items-center gap-1">
                <span className="w-2 h-1 rounded bg-amber-400 inline-block" />
                Bogey Arc
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rotate-45 bg-cyan-400 inline-block" />
                Ally BLE
              </span>
              <span
                className={`flex items-center gap-1 ${
                  bleOnlyMode ? 'line-through opacity-40' : ''
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                Squad GPS
              </span>
              <button
                type="button"
                onClick={() => setBleOnlyMode((v) => !v)}
                className={`px-1.5 py-0.5 rounded border flex items-center gap-1 font-bold cursor-pointer transition ${
                  bleOnlyMode
                    ? 'bg-cyan-400 text-black border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.45)]'
                    : 'bg-black/40 border-cyan-500/35 text-cyan-300 hover:text-cyan-200'
                }`}
                title="Toggle Bluetooth-Only radar mode (hides Squad GPS dots)"
              >
                <Bluetooth className="w-2.5 h-2.5" />
                <span>{bleOnlyMode ? 'BLE ONLY: ON' : 'BLE ONLY'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Advanced Subsystems (BLE Scanner, Squad E2EE Net, Radar Calibration) */}
          <div className="lg:col-span-7 flex flex-col gap-2.5 w-full">
            <div className="grid grid-cols-3 gap-1 bg-[#07120c] p-1 rounded-xl border border-emerald-500/25">
              <button
                onClick={() => setAdvTab('BLE')}
                className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  advTab === 'BLE'
                    ? 'bg-cyan-500 text-black shadow'
                    : 'text-emerald-300/75 hover:text-emerald-200'
                }`}
              >
                <Bluetooth className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">BLE ({bogeyCount})</span>
              </button>

              <button
                onClick={() => setAdvTab('SQUAD')}
                className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  advTab === 'SQUAD'
                    ? 'bg-cyan-500 text-black shadow'
                    : 'text-emerald-300/75 hover:text-emerald-200'
                }`}
              >
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">SQUAD ({squadMembers.length})</span>
              </button>

              <button
                onClick={() => setAdvTab('CALIBRATE')}
                className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                  advTab === 'CALIBRATE'
                    ? 'bg-cyan-500 text-black shadow'
                    : 'text-emerald-300/75 hover:text-emerald-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">CALIBRATE</span>
              </button>
            </div>

            {advTab === 'BLE' && (
              <BleContactsList
                contacts={contacts}
                whitelist={whitelist}
                capabilities={capabilities}
                isScanning={isScanning}
                scanStatusText={scanStatusText}
                simEnabled={simEnabled}
                bleOnlyMode={bleOnlyMode}
                onToggleBleOnlyMode={() => setBleOnlyMode((v) => !v)}
                onStartPassiveScan={handleStartPassiveScan}
                onStopScan={handleStopScan}
                onPickDevice={handlePickDevice}
                onToggleSimulation={handleToggleSimulation}
                onWhitelistContact={handleWhitelistContact}
                onRemoveWhitelist={handleRemoveWhitelist}
                onSnapContactAhead={(deviceId) => {
                  bleEngineRef.current?.snapContactToCurrentHeading(deviceId);
                  playTacticalTone(1100, 60);
                }}
                onCalibrateOneMeter={(deviceId) => {
                  bleEngineRef.current?.calibrateContactAtOneMeter(deviceId);
                  playTacticalTone(1300, 70);
                }}
              />
            )}

            {advTab === 'SQUAD' && (
              <SquadPanel
                callsign={callsign}
                roomCode={roomCode}
                squadPin={squadPin}
                connectionStatus={squadStatus}
                connectionInfo={squadInfo}
                members={squadMembers}
                selfPeerId={selfPeerId}
                onUpdateCallsign={(cs) => {
                  setCallsign(cs);
                  p2pRef.current?.updateSelfState({ callsign: cs });
                }}
                onConnectRoom={(room, cs, pin) => {
                  try {
                    window.sessionStorage.removeItem('aegistac_squad_left');
                  } catch {
                    // ignore
                  }
                  setRoomCode(room);
                  setCallsign(cs);
                  setSquadPin(pin);
                  void p2pRef.current?.connectToRoom(room, cs, pin);
                }}
                onDisconnectRoom={() => {
                  try {
                    window.sessionStorage.setItem('aegistac_squad_left', '1');
                  } catch {
                    // ignore
                  }
                  void p2pRef.current?.disconnect();
                  playTacticalTone(520, 60);
                }}
                onAddSimulatedTeammate={handleAddSimulatedTeammate}
                onRemoveMember={(peerId) => {
                  p2pRef.current?.removeMember(peerId);
                  playTacticalTone(580, 50);
                }}
              />
            )}

            {advTab === 'CALIBRATE' && (
              <TacticalControls
                status={playerStatus}
                activePingTool={activePingTool}
                pings={pings}
                environment={environment}
                maxRangeMeters={maxRangeMeters}
                headUpMode={headUpMode}
                showSatellite={showSatellite}
                mapStyle={mapStyle}
                headingDeg={headingDeg}
                hasCompassLock={hasCompassLock}
                onStatusChange={handleStatusChange}
                onSelectPingTool={setActivePingTool}
                onQuickPingAhead={handleQuickPingAhead}
                onRemovePing={handleRemovePing}
                onClearAllPings={handleClearAllPings}
                onEnvironmentChange={handleEnvironmentChange}
                onRangeChange={setMaxRangeMeters}
                onToggleHeadUp={() => setHeadUpMode((v) => !v)}
                onToggleSatellite={() => setShowSatellite((v) => !v)}
                onToggleMapStyle={() =>
                  setMapStyle((s) => (s === 'SATELLITE' ? 'TOPO' : 'SATELLITE'))
                }
                onManualHeadingChange={handleManualHeadingChange}
                onEnableCompassSensor={handleEnableCompassSensor}
              />
            )}
          </div>
        </main>
      )}
      {/* Onboarding & Interactive Button Reference Modal */}
      <FieldManualModal isOpen={showManual} onClose={handleCloseManual} />

      {/* Download Native APK & Direct Sideload Guide Modal */}
      {showApkModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-[#07130d] border border-cyan-400/50 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2">
              <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                <Download className="w-4 h-4 text-cyan-400" />
                <span>INSTALL AEGISTAC (NO PLAY STORE NEEDED)</span>
              </div>
              <button
                onClick={() => setShowApkModal(false)}
                className="p-1 rounded-lg bg-emerald-950/60 text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Direct APK Download Button */}
            <a
              href="/aegistac.apk"
              download="aegistac-radar.apk"
              className="w-full py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(34,211,238,0.45)] transition"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD NATIVE ANDROID / WATCH .APK</span>
            </a>

            <div className="bg-black/70 border border-emerald-500/30 rounded-xl p-3 space-y-2 text-[11px]">
              <div className="text-emerald-300 font-bold">
                How to Install the .APK on Your Android Phone (No Play Store):
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-emerald-100/90 leading-relaxed">
                <li>
                  Tap <strong>DOWNLOAD NATIVE ANDROID / WATCH .APK</strong>{' '}
                  above.
                </li>
                <li>
                  If Chrome asks <em>&quot;File might be harmful&quot;</em>, tap{' '}
                  <strong>Download anyway</strong>, then tap{' '}
                  <strong>Open</strong> when finished.
                </li>
                <li>
                  If prompted for permission, toggle ON{' '}
                  <strong>Allow from this source</strong> (Install unknown apps)
                  and tap <strong>Install</strong>.
                </li>
                <li>
                   If Google Play Protect shows <em>&quot;Unrecognized app&quot;</em>{' '}
                  (because it&apos;s your private test build), tap{' '}
                  <strong>More details → Install anyway</strong>.
                </li>
              </ol>
            </div>

            <div className="bg-black/70 border border-amber-500/35 rounded-xl p-3 space-y-1.5 text-[11px]">
              <div className="text-amber-300 font-bold">
                How to Install the Same .APK onto Galaxy Watch 5:
              </div>
              <p className="text-emerald-100/85 leading-relaxed">
                1. Install the free <strong>Wear Installer 2</strong> or{' '}
                <strong>Bugjaeger</strong> app on your Android phone.
                <br />
                2. On your Galaxy Watch 5, go to{' '}
                <strong>Settings → About watch → Software info</strong> and tap{' '}
                <strong>Software version</strong> 7 times to unlock{' '}
                <strong>Developer options</strong>.
                <br />
                3. Enable <strong>Wireless debugging</strong> inside Developer
                options on the watch, pair from your phone, and select{' '}
                <code>aegistac-radar.apk</code> to beam it straight onto your
                watch!
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowApkModal(false)}
              className="w-full py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Passive BLE Sweep Setup Modal (shown when requestLEScan flag is disabled) */}
      {showBleFlagModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="w-full max-w-md bg-[#07130d] border border-emerald-400/50 rounded-2xl p-4 flex flex-col gap-3 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-emerald-500/25 pb-2">
              <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                <Radio className="w-4 h-4 text-amber-400" />
                <span>ENABLE PASSIVE BLE SWEEP (NO PAIRING)</span>
              </div>
              <button
                onClick={() => setShowBleFlagModal(false)}
                className="p-1 rounded-lg bg-emerald-950/60 text-emerald-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-emerald-100/90 leading-relaxed">
              By default, Chrome disables passive Bluetooth radar sweeping (
              <code className="text-cyan-300">requestLEScan</code>) until you
              turn on Chrome&apos;s Experimental Web Platform flag once:
            </p>

            <div className="bg-black/70 border border-amber-500/40 rounded-xl p-2.5 space-y-2 text-[11px]">
              <div className="text-amber-300 font-bold">
                10-Second One-Time Setup (Android &amp; Desktop Chrome):
              </div>
              <ol className="list-decimal list-inside space-y-1 text-emerald-100/90">
                <li>Tap <strong>COPY FLAG URL</strong> below.</li>
                <li>Paste it into your Chrome address bar and press Enter.</li>
                <li>
                  Change <strong>Experimental Web Platform features</strong> to{' '}
                  <span className="text-emerald-300 font-bold">Enabled</span>{' '}
                  and tap <strong>Relaunch</strong>.
                </li>
              </ol>

              <div className="bg-black/90 border border-emerald-500/30 rounded-lg p-2 text-[10px] text-amber-200 break-all select-all">
                chrome://flags/#enable-experimental-web-platform-features
              </div>

              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    'chrome://flags/#enable-experimental-web-platform-features'
                  );
                  setCopiedFlag(true);
                  setTimeout(() => setCopiedFlag(false), 2500);
                }}
                className="w-full py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs cursor-pointer transition"
              >
                {copiedFlag
                  ? '✓ COPIED! PASTE IN CHROME ADDRESS BAR'
                  : 'COPY FLAG URL'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowBleFlagModal(false);
                  handleToggleSimulation(true);
                }}
                className="flex-1 py-2 px-2 rounded-xl bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-[11px] font-bold cursor-pointer"
              >
                USE SIMULATOR INSTEAD
              </button>
              <button
                type="button"
                onClick={() => setShowBleFlagModal(false)}
                className="py-2 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-[11px] font-bold cursor-pointer"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
