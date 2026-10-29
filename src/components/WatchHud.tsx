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
} from 'lucide-react';
import {
  BleContact,
  PingType,
  PlayerStatus,
  SquadMember,
  TacticalPing,
} from '../types/radar';
import { RadarDisplay } from './RadarDisplay';

interface WatchHudProps {
  contacts: BleContact[];
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
  onToggleSim: () => void;
  onToggleBleOnly: () => void;
  onCycleRange: () => void;
  onToggleHeadUp: () => void;
  onCycleStatus: () => void;
  onEnemyPingTap: () => void;
  onRadarTapPing: (bearingDeg: number, distanceMeters: number) => void;
  onRemovePing: (pingId: string) => void;
  onClearAllPings: () => void;
  onExitWatchMode: () => void;
}

export const WatchHud: React.FC<WatchHudProps> = ({
  contacts,
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
  onToggleSim,
  onToggleBleOnly,
  onCycleRange,
  onToggleHeadUp,
  onCycleStatus,
  onEnemyPingTap,
  onRadarTapPing,
  onRemovePing,
  onClearAllPings,
  onExitWatchMode,
}) => {
  const closestBogey = contacts.find((c) => !c.isFriendly);

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col items-center justify-center overflow-hidden select-none">
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

        {/* ===============================================================
            12 O'CLOCK BEZEL: Threat Alert / Range Scale Pill
           =============================================================== */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1">
          <button
            type="button"
            onClick={onCycleRange}
            className={`px-3 py-1 rounded-full font-mono text-[10px] font-extrabold border backdrop-blur-md shadow-lg cursor-pointer transition ${
              closestBogey
                ? closestBogey.distanceMeters <= 12
                  ? 'bg-red-950/90 border-red-400 text-red-100 animate-pulse'
                  : 'bg-amber-950/90 border-amber-400 text-amber-100'
                : 'bg-[#07150e]/90 border-emerald-400/50 text-emerald-200'
            }`}
            title="Tap to cycle radar range scale (20m / 40m / 75m / 120m)"
          >
            {closestBogey
              ? `⚠ BOGEY ${closestBogey.distanceMeters}m • ${maxRangeMeters}m`
              : `⌚ ${maxRangeMeters}m • ${Math.round(headingDeg)}°`}
          </button>
        </div>

        {/* ===============================================================
            9 O'CLOCK BEZEL: Passive BLE Scan Toggle
           =============================================================== */}
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={isScanning ? onStopScan : onStartScan}
            className={`px-2.5 py-2 rounded-2xl font-mono text-[10px] font-extrabold border backdrop-blur-md flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer ${
              isScanning
                ? 'bg-red-600/90 border-red-300 text-white'
                : 'bg-emerald-500/90 border-emerald-200 text-black'
            }`}
          >
            <Radio
              className={`w-3.5 h-3.5 ${isScanning ? 'animate-ping' : ''}`}
            />
            <span>{isScanning ? 'LIVE' : 'SCAN'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSim}
            className={`px-2 py-1 rounded-xl font-mono text-[9px] font-bold border backdrop-blur-md cursor-pointer ${
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
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1.5">
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

        {/* ===============================================================
            6 O'CLOCK BEZEL: BLE-Only / Clear Pings / Exit Watch HUD
           =============================================================== */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleBleOnly}
            className={`px-2 py-1 rounded-full font-mono text-[9px] font-bold border backdrop-blur-md flex items-center gap-1 cursor-pointer ${
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
            className="px-2.5 py-1 rounded-full font-mono text-[9px] font-bold border bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400/60 text-emerald-200 backdrop-blur-md flex items-center gap-1 cursor-pointer"
            title="Switch to Phone / Setup Screen"
          >
            <Sliders className="w-2.5 h-2.5" />
            <span>MENU</span>
          </button>
        </div>
      </div>
    </div>
  );
};
