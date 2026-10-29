import React, { useEffect, useRef, useState } from 'react';
import {
  Radar,
  Bluetooth,
  Users,
  Sliders,
  Navigation,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
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

export const App: React.FC = () => {
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
  const [activeTab, setActiveTab] = useState<'CONTROLS' | 'BLE' | 'SQUAD'>(
    'CONTROLS'
  );
  const [expandedRadar, setExpandedRadar] = useState<boolean>(false);

  // Sensors (GPS + Compass)
  const [selfLat, setSelfLat] = useState<number | null>(null);
  const [selfLng, setSelfLng] = useState<number | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number>(0);
  const [hasCompassLock, setHasCompassLock] = useState<boolean>(false);
  const [hasGpsLock, setHasGpsLock] = useState<boolean>(false);

  // BLE State
  const [contacts, setContacts] = useState<BleContact[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistedDevice[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [simEnabled, setSimEnabled] = useState<boolean>(true);
  const [scanStatusText, setScanStatusText] = useState<string>(
    'Field Sim active. Tap BLE SWEEP for live Web Bluetooth.'
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
    engine.setSimulationEnabled(true);
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

    void p2p.connectToRoom(roomCode, callsign, squadPin);

    const pingPruneTimer = window.setInterval(() => {
      p2p.pruneExpiredPings();
    }, 1000);

    return () => {
      clearInterval(pingPruneTimer);
      engine.destroy();
      p2p.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setSelfLat(pos.coords.latitude);
        setSelfLng(pos.coords.longitude);
        setHasGpsLock(true);
        p2pRef.current?.updateSelfState({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {
        setHasGpsLock(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 8000,
      }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    const handleOrientation = (ev: DeviceOrientationEvent) => {
      const webkitCompass = (
        ev as unknown as { webkitCompassHeading?: number }
      ).webkitCompassHeading;

      let heading: number | null = null;
      if (typeof webkitCompass === 'number') {
        heading = webkitCompass;
      } else if (typeof ev.alpha === 'number') {
        heading = (360 - ev.alpha) % 360;
      }

      if (heading !== null) {
        setHeadingDeg(heading);
        setHasCompassLock(true);
        bleEngineRef.current?.setCurrentHeading(heading);
        p2pRef.current?.updateSelfState({ heading });
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () =>
      window.removeEventListener('deviceorientation', handleOrientation, true);
  }, []);

  const handleStartPassiveScan = async () => {
    if (!bleEngineRef.current) return;
    const res = await bleEngineRef.current.startContinuousScan();
    setScanStatusText(res.message);
    if (res.ok) {
      setIsScanning(true);
      playTacticalTone(1040, 80);
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
      expiresAt: now + 45000,
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

    setSquadMembers((prev) => [...prev, mate]);
    playTacticalTone(940, 80);
  };

  const bogeyCount = contacts.filter((c) => !c.isFriendly).length;
  const closestBogey = contacts.find((c) => !c.isFriendly);

  return (
    <div className="min-h-dvh w-full bg-[#050b07] text-emerald-100 flex flex-col select-none">
      {/* Compact Responsive Header */}
      <header className="sticky top-0 z-30 bg-[#07120c]/95 backdrop-blur border-b border-emerald-500/25 px-2.5 py-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center shrink-0">
            <Radar
              className="w-3.5 h-3.5 text-emerald-400 animate-spin"
              style={{ animationDuration: '6s' }}
            />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[11px] sm:text-xs font-extrabold tracking-wider text-emerald-300 flex items-center gap-1.5 truncate">
              <span className="truncate">AEGISTAC</span>
              <span className="text-[9px] bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 rounded text-emerald-200 shrink-0">
                {callsign}
              </span>
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono text-emerald-400/70 flex items-center gap-1.5 truncate">
              <span>HDG {Math.round(headingDeg)}°</span>
              <span>•</span>
              <span>{hasGpsLock ? 'GPS' : 'GRID'}</span>
              <span>•</span>
              <span>{maxRangeMeters}m</span>
            </div>
          </div>
        </div>

        {/* Threat Proximity Pill & Audio / Expand Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {closestBogey ? (
            <div
              className={`px-2 py-0.5 rounded-full font-mono text-[10px] font-bold border flex items-center gap-1 ${
                closestBogey.distanceMeters <= 12
                  ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse'
                  : 'bg-amber-950/80 border-amber-500/60 text-amber-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              <span>
                {closestBogey.distanceMeters}m{' '}
                {closestBogey.trend === 'APPROACHING' ? '▲' : ''}
              </span>
            </div>
          ) : (
            <div className="px-2 py-0.5 rounded-full font-mono text-[10px] bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
              CLEAR
            </div>
          )}

          <button
            onClick={() => setExpandedRadar((v) => !v)}
            className="p-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 hover:text-emerald-100 cursor-pointer lg:hidden"
            title={expandedRadar ? 'Compact Radar View' : 'Maximize Radar View'}
          >
            {expandedRadar ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setAudioAlerts((v) => !v)}
            className="p-1.5 rounded-lg bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 hover:text-emerald-100 cursor-pointer"
            title="Toggle Audio Alerts"
          >
            {audioAlerts ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Responsive Layout:
          - Mobile/Small screens: Compact Radar on top + Tabbed Controls below so everything fits on 1 screen
          - Wide screens (lg+): Side-by-side Radar on left + Tabbed/Stacked Controls on right */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-2.5 py-2 grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-start">
        {/* Left/Top Column: 360° Tactical Radar */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center w-full">
          <div
            className={`w-full transition-all duration-200 mx-auto ${
              expandedRadar
                ? 'max-w-[380px] sm:max-w-[430px]'
                : 'max-w-[250px] xs:max-w-[280px] sm:max-w-[340px] lg:max-w-[410px]'
            }`}
          >
            <RadarDisplay
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
              onRadarTapPing={handleRadarTapPing}
            />
          </div>

          {/* Compact Radar Legend */}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-[9px] sm:text-[10px] font-mono text-emerald-300/80">
            <span className="flex items-center gap-1">
              <span className="w-2 h-1 rounded bg-amber-400 inline-block" />
              Bogey Arc
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rotate-45 bg-cyan-400 inline-block" />
              Ally BLE
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
              Squad GPS
            </span>
            <span className="flex items-center gap-1">
              <Navigation className="w-2.5 h-2.5 text-emerald-400 inline" />
              {playerStatus}
            </span>
          </div>
        </div>

        {/* Right/Bottom Column: Control Deck */}
        <div className="lg:col-span-6 flex flex-col gap-2 w-full">
          {/* Tab Switcher (Visible on all screens so the control deck never overflows vertically) */}
          <div className="grid grid-cols-3 gap-1 bg-[#07120c] p-1 rounded-xl border border-emerald-500/25">
            <button
              onClick={() => setActiveTab('CONTROLS')}
              className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                activeTab === 'CONTROLS'
                  ? 'bg-emerald-600 text-black shadow'
                  : 'text-emerald-300/75 hover:text-emerald-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">HUD & PINGS</span>
            </button>

            <button
              onClick={() => setActiveTab('BLE')}
              className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                activeTab === 'BLE'
                  ? 'bg-emerald-600 text-black shadow'
                  : 'text-emerald-300/75 hover:text-emerald-200'
              }`}
            >
              <Bluetooth className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">BLE ({bogeyCount})</span>
            </button>

            <button
              onClick={() => setActiveTab('SQUAD')}
              className={`py-1.5 px-2 rounded-lg font-mono text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition ${
                activeTab === 'SQUAD'
                  ? 'bg-emerald-600 text-black shadow'
                  : 'text-emerald-300/75 hover:text-emerald-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">SQUAD ({squadMembers.length})</span>
            </button>
          </div>

          {/* Active Control Panel (or on extra-large desktop screens, show active tab + quick BLE/Squad below) */}
          {activeTab === 'CONTROLS' && (
            <TacticalControls
              status={playerStatus}
              activePingTool={activePingTool}
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

          {activeTab === 'BLE' && (
            <BleContactsList
              contacts={contacts}
              whitelist={whitelist}
              capabilities={capabilities}
              isScanning={isScanning}
              scanStatusText={scanStatusText}
              simEnabled={simEnabled}
              onStartPassiveScan={handleStartPassiveScan}
              onStopScan={handleStopScan}
              onPickDevice={handlePickDevice}
              onToggleSimulation={handleToggleSimulation}
              onWhitelistContact={handleWhitelistContact}
              onRemoveWhitelist={handleRemoveWhitelist}
            />
          )}

          {activeTab === 'SQUAD' && (
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
                setRoomCode(room);
                setCallsign(cs);
                setSquadPin(pin);
                void p2pRef.current?.connectToRoom(room, cs, pin);
              }}
              onDisconnectRoom={() => p2pRef.current?.disconnect()}
              onAddSimulatedTeammate={handleAddSimulatedTeammate}
            />
          )}
        </div>
      </main>
    </div>
  );
};
