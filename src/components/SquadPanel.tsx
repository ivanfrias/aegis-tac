import React, { useState } from 'react';
import {
  Users,
  Wifi,
  Link2Off,
  UserPlus,
  Lock,
  Eye,
  EyeOff,
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
}) => {
  const [inputRoom, setInputRoom] = useState(roomCode);
  const [inputCallsign, setInputCallsign] = useState(callsign);
  const [inputPin, setInputPin] = useState(squadPin);
  const [showPin, setShowPin] = useState(false);

  const isConnected =
    connectionStatus === 'CONNECTED_HOST' ||
    connectionStatus === 'CONNECTED_PEER';

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateCallsign(inputCallsign);
    onConnectRoom(inputRoom, inputCallsign, inputPin);
  };

  return (
    <div className="bg-[#08140e]/90 border border-emerald-500/25 rounded-xl p-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-200">
            Private E2EE Squad Net
          </span>
          <span
            className="flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 text-[10px] font-mono px-1.5 py-0.5 rounded"
            title="SHA-256 Stealth Room ID + AES-256-GCM End-to-End Encrypted Telemetry"
          >
            <Lock className="w-2.5 h-2.5" />
            <span>AES-256</span>
          </span>
        </div>

        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
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
            : connectionStatus}
        </span>
      </div>

      {/* Room, Callsign & Secret Squad PIN Form */}
      <form onSubmit={handleJoinSubmit} className="grid grid-cols-12 gap-2">
        <input
          type="text"
          value={inputCallsign}
          onChange={(e) => setInputCallsign(e.target.value.toUpperCase())}
          placeholder="CALLSIGN"
          maxLength={10}
          className="col-span-4 bg-black/60 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-xs font-mono text-emerald-100 focus:outline-none focus:border-emerald-400"
          title="Your Tactical Callsign"
        />
        <input
          type="text"
          value={inputRoom}
          onChange={(e) => setInputRoom(e.target.value.toUpperCase())}
          placeholder="ROOM"
          maxLength={10}
          className="col-span-3 bg-black/60 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
          title="Squad Room Code"
        />
        <div className="col-span-3 relative flex items-center">
          <input
            type={showPin ? 'text' : 'password'}
            value={inputPin}
            onChange={(e) => setInputPin(e.target.value)}
            placeholder="PIN/KEY"
            maxLength={16}
            className="w-full bg-black/60 border border-amber-500/35 rounded-lg pl-2 pr-6 py-1.5 text-xs font-mono text-amber-200 focus:outline-none focus:border-amber-400"
            title="Secret Squad PIN (used for SHA-256 stealth room ID and AES-256 encryption)"
          />
          <button
            type="button"
            onClick={() => setShowPin((v) => !v)}
            className="absolute right-1.5 text-emerald-400/60 hover:text-emerald-300 cursor-pointer"
            title={showPin ? 'Hide Squad PIN' : 'Show Squad PIN'}
          >
            {showPin ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {!isConnected ? (
          <button
            type="submit"
            className="col-span-2 bg-cyan-600 hover:bg-cyan-500 text-black font-mono font-bold text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer"
          >
            <Wifi className="w-3.5 h-3.5" />
            <span>LINK</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onDisconnectRoom}
            className="col-span-2 bg-red-600/80 hover:bg-red-500 text-white font-mono font-bold text-xs rounded-lg flex items-center justify-center gap-1 cursor-pointer"
            title="Disconnect from Squad Room"
          >
            <Link2Off className="w-3.5 h-3.5" />
          </button>
        )}
      </form>

      <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300/70">
        <span className="truncate">{connectionInfo}</span>
        <button
          type="button"
          onClick={onAddSimulatedTeammate}
          className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
          title="Spawn a simulated squadmate on the radar to test friendly tracking"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+Test Squadmate</span>
        </button>
      </div>

      {/* Squad Roster */}
      <div className="space-y-1.5 max-h-36 overflow-y-auto">
        {members.map((m) => {
          const isSelf = m.peerId === selfPeerId;
          return (
            <div
              key={m.peerId}
              className="flex items-center justify-between bg-black/40 border border-emerald-500/20 rounded-lg px-2.5 py-1.5 font-mono text-xs"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    m.status === 'ACTIVE'
                      ? 'bg-emerald-400'
                      : m.status === 'MEDIC'
                      ? 'bg-red-500 animate-ping'
                      : 'bg-zinc-500'
                  }`}
                />
                <span className="font-bold text-emerald-100">
                  {m.callsign} {isSelf && '(YOU)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-emerald-400/70">
                  HDG {Math.round(m.heading)}°
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    m.status === 'ACTIVE'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : m.status === 'MEDIC'
                      ? 'bg-red-500/30 text-red-200 animate-pulse'
                      : 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {m.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
