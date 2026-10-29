import React, { useState } from 'react';
import {
  Users,
  Wifi,
  Link2Off,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import { SquadMember } from '../types/radar';
import { SquadConnectionStatus } from '../services/squadP2P';

interface SquadPanelProps {
  callsign: string;
  roomCode: string;
  squadPin: string;
  connectionStatus: SquadConnectionStatus;
  connectionInfo: string;
  members: SquadMember[];
  selfPeerId: string;
  onUpdateCallsign: (callsign: string) => void;
  onConnectRoom: (roomCode: string, callsign: string, squadPin: string) => void;
  onDisconnectRoom: () => void;
  onAddSimulatedTeammate: () => void;
  onRemoveMember: (peerId: string) => void;
}

export const SquadPanel: React.FC<SquadPanelProps> = ({
  callsign,
  roomCode,
  squadPin,
  connectionStatus,
  connectionInfo,
  members,
  selfPeerId,
  onUpdateCallsign,
  onConnectRoom,
  onDisconnectRoom,
  onAddSimulatedTeammate,
  onRemoveMember,
}) => {
  const [inputRoom, setInputRoom] = useState(roomCode);
  const [inputCallsign, setInputCallsign] = useState(callsign);
  const [inputPin, setInputPin] = useState(squadPin);
  const [showPin, setShowPin] = useState(false);

  const isConnected =
    connectionStatus === 'CONNECTED_HOST' ||
    connectionStatus === 'CONNECTED_PEER';
  const canLeaveOrReset =
    isConnected ||
    connectionStatus === 'CONNECTING' ||
    members.length > 1;

  const hasPendingEdits =
    isConnected &&
    (inputRoom.trim().toUpperCase() !== roomCode.trim().toUpperCase() ||
      inputCallsign.trim().toUpperCase() !== callsign.trim().toUpperCase() ||
      inputPin.trim() !== squadPin.trim());

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCallsign(inputCallsign);
    onConnectRoom(inputRoom, inputCallsign, inputPin);
  };

  return (
    <div className="bg-[#08140e]/95 border border-emerald-500/25 rounded-xl p-2.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-200">
            Squad Net
          </span>
          <span
            className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[9px] font-mono px-1.5 py-0.5 rounded"
            title="SHA-256 Stealth Room ID + AES-256-GCM End-to-End Encrypted Telemetry"
          >
            <Lock className="w-2.5 h-2.5" />
            <span>AES-256</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${
              isConnected
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : connectionStatus === 'CONNECTING'
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 animate-pulse'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400'
            }`}
          >
            {connectionStatus === 'CONNECTED_HOST'
              ? `HOST // ${roomCode}`
              : connectionStatus === 'CONNECTED_PEER'
              ? `LINKED // ${roomCode}`
              : connectionStatus === 'DISCONNECTED'
              ? 'SOLO // OFFLINE'
              : connectionStatus}
          </span>

          {canLeaveOrReset && (
            <button
              type="button"
              onClick={onDisconnectRoom}
              className="bg-red-600 hover:bg-red-500 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded border border-red-400/60 flex items-center gap-1 cursor-pointer shadow"
              title="Disconnect from current squad and return to Solo mode"
            >
              <Link2Off className="w-3 h-3 shrink-0" />
              <span>EXIT SQUAD</span>
            </button>
          )}
        </div>
      </div>

      {/* Responsive Form so inputs never overflow on narrow phone screens */}
      <form onSubmit={handleJoinSubmit} className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <input
          type="text"
          value={inputCallsign}
          onChange={(e) => setInputCallsign(e.target.value.toUpperCase())}
          placeholder="CALLSIGN"
          maxLength={10}
          className="bg-black/60 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-[11px] font-mono text-emerald-100 focus:outline-none focus:border-emerald-400 min-w-0"
          title="Your Tactical Callsign"
        />
        <input
          type="text"
          value={inputRoom}
          onChange={(e) => setInputRoom(e.target.value.toUpperCase())}
          placeholder="ROOM"
          maxLength={10}
          className="bg-black/60 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-[11px] font-mono text-cyan-200 focus:outline-none focus:border-cyan-400 min-w-0"
          title="Squad Room Code"
        />
        <div className="relative flex items-center min-w-0">
          <input
            type={showPin ? 'text' : 'password'}
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value)}
            placeholder="PIN/KEY"
            maxLength={16}
            className="w-full bg-black/60 border border-amber-500/35 rounded-lg pl-2 pr-6 py-1.5 text-[11px] font-mono text-amber-200 focus:outline-none focus:border-amber-400 min-w-0"
            title="Secret Squad PIN"
          />
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            className="absolute right-1.5 text-emerald-400/60 hover:text-emerald-300 cursor-pointer"
          >
            {showPin ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {!isConnected || hasPendingEdits ? (
          <button
            type="submit"
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
          >
            <Wifi className="w-3.5 h-3.5 shrink-0" />
            <span>{isConnected ? 'SWITCH ROOM' : 'JOIN SQUAD'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onDisconnectRoom}
            className="bg-red-600/90 hover:bg-red-500 text-white font-mono font-bold text-[11px] py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer"
          >
            <Link2Off className="w-3.5 h-3.5 shrink-0" />
            <span>LEAVE SQUAD</span>
          </button>
        )}
      </form>

      <div className="flex items-center justify-between text-[10px] font-mono text-emerald-300/70 gap-2">
        <span className="truncate">{connectionInfo}</span>
        <button
          type="button"
          onClick={onAddSimulatedTeammate}
          className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <UserPlus className="w-3 h-3" />
          <span>+Test Mate</span>
        </button>
      </div>

      {/* Squad Roster */}
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {members.map((m) => {
          const isSelf = m.peerId === selfPeerId;
          return (
            <div
              key={m.peerId}
              className="flex items-center justify-between bg-black/40 border border-emerald-500/20 rounded-lg px-2 py-1 font-mono text-[11px]"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    m.status === 'ACTIVE'
                      ? 'bg-emerald-400'
                      : m.status === 'MEDIC'
                      ? 'bg-red-500 animate-ping'
                      : 'bg-zinc-500'
                  }`}
                />
                <span className="font-bold text-emerald-100 truncate">
                  {m.callsign} {isSelf && '(YOU)'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[9px] text-emerald-400/70">
                  {Math.round(m.heading)}°
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                    m.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : m.status === 'MEDIC'
                      ? 'bg-red-500/30 text-red-200 animate-pulse'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {m.status}
                </span>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => onRemoveMember(m.peerId)}
                    className="p-0.5 rounded bg-red-950/60 hover:bg-red-800/80 text-red-300 border border-red-500/40 cursor-pointer"
                    title={`Remove ${m.callsign} from squad roster`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
