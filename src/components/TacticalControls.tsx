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
  Trash2,
  X,
} from 'lucide-react';
import {
  ENVIRONMENT_CONFIG,
  EnvironmentPreset,
  PingType,
  PlayerStatus,
  TacticalPing,
} from '../types/radar';

interface TacticalControlsProps {
  status: PlayerStatus;
  activePingTool: PingType | null;
  pings: TacticalPing[];
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
  onRemovePing: (pingId: string) => void;
  onClearAllPings: () => void;
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
  pings,
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
  onRemovePing,
  onClearAllPings,
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
      onQuickPingAhead(type);
      onSelectPingTool(null);
    } else {
      onSelectPingTool(type);
    }
  };

  return (
    <div className="bg-[#08140e]/95 border border-emerald-500/25 rounded-xl p-2.5 flex flex-col gap-2">
      {/* Row 1: Glove-Friendly Player Status Buttons (ACTIVE / HIT / MEDIC) */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => onStatusChange('ACTIVE')}
          className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition cursor-pointer ${
            status === 'ACTIVE'
              ? 'bg-emerald-500 text-black border-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.45)]'
              : 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30 hover:bg-emerald-900/40'
          }`}
        >
          <Shield className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">IN PLAY</span>
        </button>

        <button
          onClick={() => onStatusChange('HIT')}
          className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition cursor-pointer ${
            status === 'HIT'
              ? 'bg-zinc-300 text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.35)]'
              : 'bg-zinc-900/80 text-zinc-300 border-zinc-600/40 hover:bg-zinc-800'
          }`}
        >
          <Skull className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">HIT / OUT</span>
        </button>

        <button
          onClick={() => onStatusChange('MEDIC')}
          className={`flex items-center justify-center gap-1 py-2 px-1.5 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition cursor-pointer ${
            status === 'MEDIC'
              ? 'bg-red-600 text-white border-red-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.65)]'
              : 'bg-red-950/50 text-red-300 border-red-500/40 hover:bg-red-900/50'
          }`}
        >
          <HeartPulse className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">MEDIC!</span>
        </button>
      </div>

      {/* Row 2: Tactical Pings */}
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400/75 mb-1">
          <span className="truncate">
            PINGS (1-TAP PLACE ON RADAR • 2-TAP 20M AHEAD)
          </span>
          {activePingTool && (
            <button
              onClick={() => onSelectPingTool(null)}
              className="text-red-300 underline ml-2 shrink-0 cursor-pointer"
            >
              CANCEL
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            onClick={() => handlePingButtonClick('ENEMY')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition cursor-pointer ${
              activePingTool === 'ENEMY'
                ? 'bg-red-600 text-white border-red-300'
                : 'bg-red-950/40 text-red-300 border-red-500/35 hover:bg-red-900/40'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">ENEMY</span>
          </button>

          <button
            onClick={() => handlePingButtonClick('DANGER')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition cursor-pointer ${
              activePingTool === 'DANGER'
                ? 'bg-orange-500 text-black border-orange-200'
                : 'bg-orange-950/40 text-orange-300 border-orange-500/35 hover:bg-orange-900/40'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">DANGER</span>
          </button>

          <button
            onClick={() => handlePingButtonClick('OBJECTIVE')}
            className={`flex items-center justify-center gap-1 py-1.5 px-1.5 rounded-lg font-mono text-[11px] sm:text-xs font-bold border transition cursor-pointer ${
              activePingTool === 'OBJECTIVE'
                ? 'bg-yellow-400 text-black border-yellow-100'
                : 'bg-yellow-950/40 text-yellow-300 border-yellow-500/35 hover:bg-yellow-900/40'
            }`}
          >
            <Flag className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">OBJ</span>
          </button>
        </div>

        {/* Active Pings List & Clear Button */}
        {pings.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 bg-black/50 border border-red-500/25 rounded-lg p-1.5">
            <div className="flex flex-wrap items-center gap-1">
              {pings.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onRemovePing(p.id)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-950/70 hover:bg-red-900 border border-red-500/40 text-red-200 font-mono text-[10px] cursor-pointer"
                  title="Tap to remove this ping"
                >
                  <span>
                    {p.type} ({p.distanceMeters}m)
                  </span>
                  <X className="w-3 h-3 text-red-400" />
                </button>
              ))}
            </div>
            <button
              onClick={onClearAllPings}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-600/80 hover:bg-red-500 text-white font-mono text-[10px] font-bold cursor-pointer shrink-0"
            >
              <Trash2 className="w-3 h-3" />
              <span>CLEAR ALL</span>
            </button>
          </div>
        )}
      </div>

      {/* Row 3: Environment Preset */}
      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-emerald-500/15">
        {(['CQB', 'COMPOUND', 'WOODLAND'] as EnvironmentPreset[]).map((env) => {
          const cfg = ENVIRONMENT_CONFIG[env];
          const active = environment === env;
          return (
            <button
              key={env}
              onClick={() => onEnvironmentChange(env)}
              className={`py-1 px-1.5 rounded border font-mono text-[10px] sm:text-[11px] transition cursor-pointer ${
                active
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 font-bold'
                  : 'bg-black/40 border-emerald-500/20 text-emerald-400/70 hover:text-emerald-200'
              }`}
            >
              <div className="truncate">{env}</div>
              <div className="text-[9px] opacity-75">
                {cfg.defaultRangeMeters}m
              </div>
            </button>
          );
        })}
      </div>

      {/* Row 4: Map Overlay, Orientation & Range Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-emerald-500/15">
        <div className="flex flex-wrap items-center gap-1">
          <button
            onClick={onToggleSatellite}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border cursor-pointer ${
              showSatellite
                ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                : 'bg-black/40 border-emerald-500/25 text-emerald-400/70'
            }`}
          >
            <MapIcon className="w-3 h-3" />
            <span>{showSatellite ? 'MAP ON' : 'MAP OFF'}</span>
          </button>

          {showSatellite && (
            <button
              onClick={onToggleMapStyle}
              className="px-2 py-1 rounded text-[10px] font-mono border bg-black/40 border-emerald-500/25 text-emerald-300 cursor-pointer"
            >
              {mapStyle === 'SATELLITE' ? 'SAT' : 'TOPO'}
            </button>
          )}

          <button
            onClick={onToggleHeadUp}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono border bg-black/40 border-emerald-500/25 text-emerald-300 cursor-pointer"
          >
            <Compass className="w-3 h-3" />
            <span>{headUpMode ? 'HEAD-UP' : 'NORTH'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-[10px] font-mono">
          {[20, 40, 75, 120].map((r) => (
            <button
              key={r}
              onClick={() => onRangeChange(r)}
              className={`px-1.5 py-0.5 rounded border cursor-pointer ${
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

      {/* Row 5: Compass Calibration & Manual Heading Slider */}
      <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-300/80">
        <button
          onClick={onEnableCompassSensor}
          className="bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] hover:border-emerald-400 shrink-0 cursor-pointer"
        >
          {hasCompassLock ? 'COMPASS OK' : 'SYNC COMPASS'}
        </button>
        <input
          type="range"
          min={0}
          max={359}
          value={Math.round(headingDeg)}
          onChange={(e) => onManualHeadingChange(Number(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer h-1.5"
        />
        <span className="w-9 text-right font-bold text-emerald-200 shrink-0">
          {Math.round(headingDeg)}°
        </span>
      </div>
    </div>
  );
};
