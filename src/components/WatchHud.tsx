import React from 'react';
import {
  Radio,
  Crosshair,
  HeartPulse,
  Shield,
  Skull,
  Trash2,
  Sliders,
  Bluetooth,
  ZoomIn,
  ZoomOut,
  Power,
  Filter,
} from 'lucide-react';
import {
  BleContact,
  PingType,
  PlayerStatus,
  SquadMember,
  TacticalPing,
} from '../types/radar';
import { RadarDisplay } from './RadarDisplay';

export type BleHudFilterMode = 'TOP_5' | 'ALL' | 'NONE';

interface WatchHudProps {
  contacts: BleContact[];
  totalDetectedCount: number;
  bleFilterMode: BleHudFilterMode;
  squadMembers: SquadMember[];
  selfPeerId: string;
  pings: TacticalPing[];
  selfLat: number | null;
  selfLng: number | null;
  headingDeg: number;
  maxRangeMeters: number;
  headUpMode: boolean;
  showSatellite: boolean;
  mapStyle: 'SATELLITE' | 'TOPO';
  activePingTool: PingType | null;
  isScanning: boolean;
  simEnabled: boolean;
  bleOnlyMode: boolean;
  playerStatus: PlayerStatus;
  onStartScan: () => void;
  onStopScan: () => void;
  onCycleBleFilter: () => void;
  onToggleSim: () => void;
  onToggleBleOnly: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCycleRange: () => void;
  onToggleHeadUp: () => void;
  onCycleStatus: () => void;
  onEnemyPingTap: () => void;
  onRadarTapPing: (bearingDeg: number, distanceMeters: number) => void;
  onRemovePing: (pingId: string) => void;
  onClearAllPings: () => void;
  onExitWatchMode: () => void;
  onQuitApp: () => void;
}

export const WatchHud: React.FC<WatchHudProps> = ({
  contacts,
  totalDetectedCount,
  bleFilterMode,
  squadMembers,
  selfPeerId,
  pings,
  selfLat,
  selfLng,
  headingDeg,
  maxRangeMeters,
  headUpMode,
  showSatellite,
  mapStyle,
  activePingTool,
  isScanning,
  simEnabled,
  bleOnlyMode,
  playerStatus,
  onStartScan,
  onStopScan,
  onCycleBleFilter,
  onToggleSim,
  onToggleBleOnly,
  onZoomIn,
  onZoomOut,
  onCycleRange,
  onToggleHeadUp,
  onCycleStatus,
  onEnemyPingTap,
  onRadarTapPing,
  onRemovePing,
  onClearAllPings,
  onExitWatchMode,
  onQuitApp,
}) => {
  const closestBogey = contacts.find((c) => !c.isFriendly);
  const [zoomToast, setZoomToast] = React.useState<string | null>(null);
  const toastTimeoutRef = React.useRef<number | null>(null);
  const lastWheelTime = React.useRef<number>(0);

  const showZoomFeedback = (msg: string) => {
    setZoomToast(msg);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => setZoomToast(null), 1200);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelTime.current < 200) return;
    lastWheelTime.current = now;
    if (e.deltaY < 0) {
      onZoomIn();
      showZoomFeedback('ZOOM IN');
    } else if (e.deltaY > 0) {
      onZoomOut();
      showZoomFeedback('ZOOM OUT');
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black flex flex-col items-center justify-center overflow-hidden select-none"
      onWheel={handleWheel}
    >
      {/* Circular Smartwatch Bezel Frame (Fits 100% edge-to-edge on Galaxy Watch 5, or renders a circular watch dial on Phone/Desktop) */}
      <div className="relative w-[min(100dvw,100dvh,420px)] h-[min(100dvw,100dvh,420px)] rounded-full bg-[#040a06] border-4 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.22)] flex items-center justify-center overflow-hidden">
        {/* Full-Bleed 360° Radar Canvas */}
        <div className="w-full h-full flex items-center justify-center p-1">
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
            onRadarTapPing={onRadarTapPing}
            onRemovePing={onRemovePing}
          />
        </div>

        {/* Transient Zoom Feedback Toast */}
        {zoomToast && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 z-30 px-3 py-0.5 rounded-full bg-emerald-400 text-black font-mono text-[10px] font-black border border-white shadow-[0_0_15px_rgba(52,211,153,0.85)] animate-bounce pointer-events-none whitespace-nowrap">
            {zoomToast} • {maxRangeMeters}m
          </div>
        )}

        {/* ===============================================================
            12 O'CLOCK BEZEL: Zoom Out (-) / Threat & Range Pill / Zoom In (+)
           =============================================================== */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onZoomOut();
              showZoomFeedback('ZOOM OUT');
            }}
            className="w-8 h-8 rounded-full bg-[#07150e]/95 hover:bg-emerald-950/90 border border-emerald-400/70 text-emerald-200 flex items-center justify-center font-mono text-base font-black shadow-lg cursor-pointer active:scale-90 transition select-none"
            title="Zoom Out (-): Increase radar range scale"
          >
            −
          </button>

          <button
            type="button"
            onClick={() => {
              onCycleRange();
              showZoomFeedback('SCALE');
            }}
            className={`px-2.5 py-1 rounded-full font-mono text-[10px] font-extrabold border backdrop-blur-md shadow-lg cursor-pointer transition select-none ${
              closestBogey
                ? closestBogey.distanceMeters <= 12
                  ? 'bg-red-950/90 border-red-400 text-red-100 animate-pulse'
                  : 'bg-amber-950/90 border-amber-400 text-amber-100'
                : 'bg-[#07150e]/90 border-emerald-400/50 text-emerald-200'
            }`}
            title="Tap to cycle radar range scale (5m / 10m / 20m / 35m / 50m / 75m / 120m)"
          >
            {closestBogey
              ? `⚠ ${closestBogey.distanceMeters}m • ${maxRangeMeters}m`
              : `⌚ ${maxRangeMeters}m (${contacts.length}/${totalDetectedCount})`}
          </button>

          <button
            type="button"
            onClick={() => {
              onZoomIn();
              showZoomFeedback('ZOOM IN');
            }}
            className="w-8 h-8 rounded-full bg-[#07150e]/95 hover:bg-emerald-950/90 border border-emerald-400/70 text-emerald-200 flex items-center justify-center font-mono text-base font-black shadow-lg cursor-pointer active:scale-90 transition select-none"
            title="Zoom In (+): Decrease radar range scale for close quarters"
          >
            +
          </button>
        </div>

        {/* ===============================================================
            9 O'CLOCK BEZEL: Swarmed Node Filter (TOP 5 / ALL / NONE) + SIM
           =============================================================== */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onCycleBleFilter}
            className={`px-2 py-1.5 rounded-2xl font-mono text-[9px] font-extrabold border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer ${
              bleFilterMode === 'TOP_5'
                ? 'bg-cyan-500/90 border-cyan-200 text-black'
                : bleFilterMode === 'ALL'
                ? 'bg-emerald-500/90 border-emerald-200 text-black'
                : 'bg-zinc-900/90 border-zinc-500 text-zinc-300'
            }`}
            title="Cycle Swarmed HUD Filter: Show Closest 5 First (TOP 5) → Show All (ALL) → Show None / Scanner Off (NONE)"
          >
            <Filter className="w-3 h-3" />
            <span>
              {bleFilterMode === 'TOP_5'
                ? 'TOP 5'
                : bleFilterMode === 'ALL'
                ? 'ALL'
                : 'NONE'}
            </span>
          </button>

          <button
            type="button"
            onClick={isScanning ? onStopScan : onStartScan}
            className={`px-2 py-1 rounded-xl font-mono text-[9px] font-extrabold border backdrop-blur-md flex items-center justify-center gap-1 shadow cursor-pointer ${
              isScanning
                ? 'bg-red-600/90 border-red-300 text-white'
                : 'bg-emerald-950/90 border-emerald-400/50 text-emerald-200'
            }`}
          >
            <Radio
              className={`w-2.5 h-2.5 ${isScanning ? 'animate-ping' : ''}`}
            />
            <span>{isScanning ? 'ON' : 'SCAN'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSim}
            className={`px-2 py-0.5 rounded-xl font-mono text-[8px] font-bold border backdrop-blur-md cursor-pointer ${
              simEnabled
                ? 'bg-amber-500/85 border-amber-200 text-black'
                : 'bg-black/75 border-emerald-500/35 text-emerald-300/80'
            }`}
          >
            {simEnabled ? 'SIM ON' : 'SIM'}
          </button>
        </div>

        {/* ===============================================================
            3 O'CLOCK BEZEL: Quick Enemy Ping & Status Cycle
           =============================================================== */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={onEnemyPingTap}
            className={`px-2.5 py-2 rounded-2xl font-mono text-[10px] font-extrabold border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer ${
              activePingTool === 'ENEMY'
                ? 'bg-red-500 text-black border-white animate-pulse'
                : 'bg-red-950/85 border-red-500/60 text-red-200'
            }`}
            title="Tap once to arm radar tap, tap again to ping Enemy 20m ahead"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>! ENM</span>
          </button>

          <button
            type="button"
            onClick={onCycleStatus}
            className={`px-2 py-1 rounded-xl font-mono text-[9px] font-extrabold border backdrop-blur-md flex items-center justify-center gap-0.5 cursor-pointer ${
              playerStatus === 'ACTIVE'
                ? 'bg-emerald-950/85 border-emerald-400/50 text-emerald-200'
                : playerStatus === 'HIT'
                ? 'bg-zinc-200 border-white text-black'
                : 'bg-red-600 border-red-200 text-white animate-bounce'
            }`}
            title="Tap to cycle status: IN PLAY → HIT → MEDIC!"
          >
            {playerStatus === 'ACTIVE' ? (
              <Shield className="w-2.5 h-2.5" />
            ) : playerStatus === 'HIT' ? (
              <Skull className="w-2.5 h-2.5" />
            ) : (
              <HeartPulse className="w-2.5 h-2.5" />
            )}
            <span>{playerStatus === 'ACTIVE' ? 'OK' : playerStatus}</span>
          </button>
        </div>

        {/* 6 O'CLOCK BEZEL: Version & Controls */}
        <div className="absolute bottom-9 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span className="text-[8px] font-mono font-extrabold text-emerald-400/60 tracking-wider">
            v1.2.0
          </span>
        </div>

        {/* ===============================================================
            6 O'CLOCK BEZEL: BLE-Only / Head-Up / Menu / QUIT App
           =============================================================== */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleBleOnly}
            className={`px-2 py-1 rounded-full font-mono text-[9px] font-bold border backdrop-blur-md flex items-center gap-0.5 cursor-pointer ${
              bleOnlyMode
                ? 'bg-cyan-400 text-black border-cyan-100'
                : 'bg-black/80 border-cyan-500/40 text-cyan-300'
            }`}
          >
            <Bluetooth className="w-2.5 h-2.5" />
            <span>{bleOnlyMode ? 'BLE' : 'ALL'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleHeadUp}
            className="px-2 py-1 rounded-full font-mono text-[9px] font-bold border bg-black/80 border-emerald-500/40 text-emerald-300 backdrop-blur-md cursor-pointer"
          >
            {headUpMode ? 'HD-UP' : 'N-UP'}
          </button>

          {pings.length > 0 && (
            <button
              type="button"
              onClick={onClearAllPings}
              className="px-2 py-1 rounded-full font-mono text-[9px] font-bold border bg-red-600/90 border-red-300 text-white backdrop-blur-md flex items-center gap-0.5 cursor-pointer"
            >
              <Trash2 className="w-2.5 h-2.5" />
              <span>CLR</span>
            </button>
          )}

          <button
            type="button"
            onClick={onExitWatchMode}
            className="px-2 py-1 rounded-full font-mono text-[9px] font-bold border bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400/60 text-emerald-200 backdrop-blur-md flex items-center gap-0.5 cursor-pointer"
            title="Switch to Phone / Setup Screen"
          >
            <Sliders className="w-2.5 h-2.5" />
            <span>HUD</span>
          </button>

          <button
            type="button"
            onClick={onQuitApp}
            className="px-2 py-1 rounded-full font-mono text-[9px] font-extrabold border bg-red-950/95 hover:bg-red-800 border-red-400 text-red-200 backdrop-blur-md flex items-center gap-0.5 cursor-pointer"
            title="Stop all scanners and Quit AegisTac"
          >
            <Power className="w-2.5 h-2.5" />
            <span>QUIT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
