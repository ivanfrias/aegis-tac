import React from 'react';
import {
  Crosshair,
  AlertTriangle,
  Flag,
  HeartPulse,
  Skull,
  Shield,
  Compass,
  Map as MapIcon,
} from 'lucide-react';
import {
  ENVIRONMENT_CONFIG,
  EnvironmentPreset,
  PingType,
  PlayerStatus,
} from '../types/radar';

interface TacticalControlsProps {
  status: PlayerStatus;
  activePingTool: PingType | null;
  environment: EnvironmentPreset;
  maxRangeMeters: number;
  headUpMode: boolean;
  showSatellite: boolean;
  mapStyle: 'SATELLITE' | 'TOPO';
  headingDeg: number;
  hasCompassLock: boolean;
  onStatusChange: (status: PlayerStatus) => void;
  onSelectPingTool: (type: PingType | null) => void;
  onQuickPingAhead: (type: PingType) => void;
  onEnvironmentChange: (env: EnvironmentPreset) => void;
  onRangeChange: (meters: number) => void;
  onToggleHeadUp: () => void;
  onToggleSatellite: () => void;
  onToggleMapStyle: () => void;
  onManualHeadingChange: (deg: number) => void;
  onEnableCompassSensor: () => void;
}

export const TacticalControls: React.FC<TacticalControlsProps> = ({
  status,
  activePingTool,
  environment,
  maxRangeMeters,
  headUpMode,
  showSatellite,
  mapStyle,
  headingDeg,
  hasCompassLock,
  onStatusChange,
  onSelectPingTool,
  onQuickPingAhead,
  onEnvironmentChange,
  onRangeChange,
  onToggleHeadUp,
  onToggleSatellite,
  onToggleMapStyle,
  onManualHeadingChange,
  onEnableCompassSensor,
}) => {
  const handlePingButtonClick = (type: PingType) => {
    if (activePingTool === type) {
      // Second tap immediately drops the ping 20m dead ahead of current heading
      onQuickPingAhead(type);
      onSelectPingTool(null);
    } else {
      onSelectPingTool(type);
    }
  };

  return (
    <div className="bg-[#08140e]/90 border border-emerald-500/25 rounded-xl p-3 flex flex-col gap-3">
      {/* Row 1: Glove-Friendly Player Status Buttons (ACTIVE / HIT / MEDIC) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => onStatusChange('ACTIVE')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
            status === 'ACTIVE'
              ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
              : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>IN PLAY</span>
        </button>

        <button
          onClick={() => onStatusChange('HIT')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
            status === 'HIT'
              ? 'bg-zinc-300 text-black border-white shadow-[0_0_12px_rgba(255,255,255,0.4)]'
              : 'bg-zinc-900/80 text-zinc-300 border-zinc-600/40 hover:bg-zinc-800'
          }`}
        >
          <Skull className="w-4 h-4" />
          <span>HIT / DEAD</span>
        </button>

        <button
          onClick={() => onStatusChange('MEDIC')}
          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
            status === 'MEDIC'
              ? 'bg-red-600 text-white border-red-300 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.7)]'
              : 'bg-red-950/50 text-red-300 border-red-500/40 hover:bg-red-900/50'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>MEDIC!</span>
        </button>
      </div>

      {/* Row 2: Tactical Pings (Tap once to place on radar, tap twice to drop 20m ahead) */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400/75 mb-1.5">
          <span>TACTICAL PINGS (TAP RADAR OR DOUBLE-TAP FOR 20M AHEAD)</span>
          {activePingTool && (
            <button
              onClick={() => onSelectPingTool(null)}
              className="text-red-300 underline cursor-pointer"
            >
              CANCEL
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => handlePingButtonClick('ENEMY')}
            className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
              activePingTool === 'ENEMY'
                ? 'bg-red-600 text-white border-red-300'
                : 'bg-red-950/40 text-red-300 border-red-500/35 hover:bg-red-900/40'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>ENEMY</span>
          </button>

          <button
            onClick={() => handlePingButtonClick('DANGER')}
            className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
              activePingTool === 'DANGER'
                ? 'bg-orange-500 text-black border-orange-200'
                : 'bg-orange-950/40 text-orange-300 border-orange-500/35 hover:bg-orange-900/40'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>DANGER</span>
          </button>

          <button
            onClick={() => handlePingButtonClick('OBJECTIVE')}
            className={`flex items-center justify-center gap-1 py-2 px-2 rounded-lg font-mono text-xs font-bold border transition cursor-pointer ${
              activePingTool === 'OBJECTIVE'
                ? 'bg-yellow-400 text-black border-yellow-100'
                : 'bg-yellow-950/40 text-yellow-300 border-yellow-500/35 hover:bg-yellow-900/40'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>OBJECTIVE</span>
          </button>
        </div>
      </div>

      {/* Row 3: Environment Attenuation Preset & Range Scale */}
      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-emerald-500/15">
        {(['CQB', 'COMPOUND', 'WOODLAND'] as EnvironmentPreset[]).map((env) => {
          const cfg = ENVIRONMENT_CONFIG[env];
          const active = environment === env;
          return (
            <button
              key={env}
              onClick={() => onEnvironmentChange(env)}
              className={`py-1.5 px-2 rounded border font-mono text-[11px] transition cursor-pointer ${
                active
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold'
                  : 'bg-black/40 border-emerald-500/20 text-emerald-400/70 hover:text-emerald-200'
              }`}
            >
              <div>{env}</div>
              <div className="text-[9px] opacity-75">
                {cfg.defaultRangeMeters}m scale
              </div>
            </button>
          );
        })}
      </div>

      {/* Row 4: Map Overlay, Compass Orientation & Heading Calibration */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-500/15">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleSatellite}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-mono border cursor-pointer ${
              showSatellite
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-black/40 border-emerald-500/25 text-emerald-400/70'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>{showSatellite ? 'MAP: ON' : 'MAP: OFF'}</span>
          </button>

          {showSatellite && (
            <button
              onClick={onToggleMapStyle}
              className="px-2 py-1.5 rounded text-[11px] font-mono border bg-black/40 border-emerald-500/25 text-emerald-300 cursor-pointer"
            >
              {mapStyle}
            </button>
          )}

          <button
            onClick={onToggleHeadUp}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-mono border bg-black/40 border-emerald-500/25 text-emerald-300 cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{headUpMode ? 'HEAD-UP' : 'NORTH-UP'}</span>
          </button>
        </div>

        {/* Range fine-tune */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          {[20, 40, 75, 120].map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-1.5 py-1 rounded border cursor-pointer ${
                maxRangeMeters === r
                  ? 'bg-emerald-500/30 border-emerald-400 text-emerald-100 font-bold'
                  : 'bg-black/40 border-emerald-500/20 text-emerald-400/60'
              }`}
            >
              {r}m
            </button>
          ))}
        </div>
      </div>

      {/* Compass Sensor / Manual Bearing Scrubber (for Desktop or Rotating Sweep calibration) */}
      <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-300/80">
        <button
          onClick={onEnableCompassSensor}
          className="bg-emerald-950/60 border border-emerald-500/30 px-2 py-1 rounded text-[10px] hover:border-emerald-400 shrink-0 cursor-pointer"
        >
          {hasCompassLock ? 'COMPASS LOCKED' : 'CALIBRATE COMPASS'}
        </button>
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(headingDeg)}
          onChange={(e) => onManualHeadingChange(Number(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer"
        />
        <span className="w-12 text-right font-bold text-emerald-200">
          {Math.round(headingDeg)}°
        </span>
      </div>
    </div>
  );
};
