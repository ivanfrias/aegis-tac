import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  UserPlus,
  Trash2,
  Check,
  X,
  Radio,
  Crosshair,
  Sliders,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { BleContact, WhitelistedDevice } from '../types/radar';

interface FriendlyRegistryModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: BleContact[];
  whitelist: WhitelistedDevice[];
  callsign: string;
  onClaimProximity: (maxDistanceMeters: number) => number;
  onWhitelistContact: (contact: BleContact, customLabel?: string) => void;
  onRemoveWhitelist: (deviceId: string) => void;
  onClearAllWhitelist: () => void;
  onRegisterManual: (deviceId: string, label: string) => void;
  onCalibrateOneMeter?: (deviceId: string) => void;
  onSnapContactAhead?: (deviceId: string) => void;
}

export const FriendlyRegistryModal: React.FC<FriendlyRegistryModalProps> = ({
  isOpen,
  onClose,
  contacts,
  whitelist,
  callsign,
  onClaimProximity,
  onWhitelistContact,
  onRemoveWhitelist,
  onClearAllWhitelist,
  onRegisterManual,
  onCalibrateOneMeter,
  onSnapContactAhead,
}) => {
  const [claimRadius, setClaimRadius] = useState<number>(8);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [manualId, setManualId] = useState('');
  const [manualCallsign, setManualCallsign] = useState('');
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState('');

  if (!isOpen) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleQuickClaim = (distMeters: number) => {
    const claimedCount = onClaimProximity(distMeters);
    if (claimedCount > 0) {
      showToast(`✔ Claimed ${claimedCount} device${claimedCount > 1 ? 's' : ''} within ${distMeters}m as Friendly Squad!`);
    } else {
      showToast(`No new devices within ${distMeters}m (all nearby already claimed).`);
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const idTrim = manualId.trim();
    if (!idTrim) return;
    const labelTrim = manualCallsign.trim() || `ALLY-${idTrim.slice(-4)}`;
    onRegisterManual(idTrim, labelTrim);
    setManualId('');
    setManualCallsign('');
    showToast(`Registered "${labelTrim}" as Friendly.`);
  };

  const handleSaveRename = (deviceId: string) => {
    const contact = contacts.find((c) => c.id === deviceId);
    const trimmed = editLabelText.trim();
    if (trimmed) {
      if (contact) {
        onWhitelistContact(contact, trimmed);
      } else {
        onRegisterManual(deviceId, trimmed);
      }
      showToast(`Updated callsign to "${trimmed}".`);
    }
    setEditingDeviceId(null);
  };

  const eligibleWithin5m = contacts.filter((c) => !c.isFriendly && c.distanceMeters <= 5).length;
  const eligibleWithin8m = contacts.filter((c) => !c.isFriendly && c.distanceMeters <= 8).length;
  const eligibleWithin15m = contacts.filter((c) => !c.isFriendly && c.distanceMeters <= 15).length;
  const totalBogeys = contacts.filter((c) => !c.isFriendly).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-[#07150e] border border-emerald-500/40 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col max-h-[92dvh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0a1f14] border-b border-emerald-500/30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/50 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-mono text-sm font-extrabold text-cyan-200 tracking-wide">
                FRIENDLY TEAM REGISTRY
              </h2>
              <p className="text-[10px] font-mono text-emerald-400/70">
                Staging Proximity Claim & Teammate Whitelist
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/30 flex items-center justify-center text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Transient Feedback Banner */}
        {toastMessage && (
          <div className="bg-cyan-500 text-black font-mono text-xs font-black px-4 py-2 text-center shadow animate-fade-in flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{toastMessage}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          
          {/* ===============================================================
              1. STAGING PROXIMITY CLAIM (Pre-game Staging Huddle)
             =============================================================== */}
          <div className="bg-[#0b2417] border border-emerald-500/35 rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs font-extrabold text-emerald-200 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                  <span>CLAIM BY PROXIMITY (STAGING HUDDLE)</span>
                </span>
                <p className="text-[11px] text-emerald-300/80 mt-0.5 leading-snug">
                  Before the match starts, gather your squad at spawn or staging and 1-tap claim everyone near you as Friendly Allies:
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-cyan-400/20 border border-cyan-400/50 text-cyan-300 text-[10px] font-mono font-bold shrink-0">
                {whitelist.length} ALLIES
              </span>
            </div>

            {/* Quick Distance Presets */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickClaim(5)}
                className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 cursor-pointer active:scale-95 transition"
              >
                <span className="font-mono text-xs font-black text-cyan-300">CLAIM &lt; 5m</span>
                <span className="text-[10px] font-mono text-emerald-400/70">
                  {eligibleWithin5m} device{eligibleWithin5m === 1 ? '' : 's'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickClaim(8)}
                className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black border border-cyan-300 font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)] cursor-pointer active:scale-95 transition"
              >
                <span className="font-mono text-xs font-black">CLAIM &lt; 8m ★</span>
                <span className="text-[10px] font-mono text-cyan-950 font-bold">
                  {eligibleWithin8m} in huddle
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickClaim(15)}
                className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 cursor-pointer active:scale-95 transition"
              >
                <span className="font-mono text-xs font-black text-cyan-300">CLAIM &lt; 15m</span>
                <span className="text-[10px] font-mono text-emerald-400/70">
                  {eligibleWithin15m} in perimeter
                </span>
              </button>
            </div>

            {totalBogeys > 0 && (
              <button
                type="button"
                onClick={() => handleQuickClaim(120)}
                className="w-full py-1.5 px-3 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 font-mono text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>CLAIM ALL {totalBogeys} DETECTED DEVICE{totalBogeys === 1 ? '' : 'S'} AS SQUAD</span>
              </button>
            )}
          </div>

          {/* ===============================================================
              2. CURRENTLY REGISTERED ALLIES
             =============================================================== */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>REGISTERED FRIENDLY SQUAD ({whitelist.length})</span>
              </span>

              {whitelist.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Reset all friendly teammates? They will revert to Unknown Bogeys.')) {
                      onClearAllWhitelist();
                      showToast('Reset all friendly units.');
                    }
                  }}
                  className="text-[10px] font-mono text-red-400/80 hover:text-red-300 flex items-center gap-0.5 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>UNCLAIM ALL</span>
                </button>
              )}
            </div>

            {whitelist.length === 0 ? (
              <div className="p-3 rounded-xl bg-black/40 border border-emerald-500/20 text-center font-mono text-xs text-emerald-400/50">
                No friendly teammates registered yet. Use "CLAIM &lt; 8m" above or tap any device below.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {whitelist.map((w) => {
                  const activeContact = contacts.find((c) => c.id === w.deviceId);
                  const isEditing = editingDeviceId === w.deviceId;

                  return (
                    <div
                      key={w.deviceId}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#092014] border border-cyan-500/40 font-mono text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-3.5 h-3.5 rotate-45 bg-cyan-400 shrink-0 shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
                        
                        {isEditing ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              value={editLabelText}
                              onChange={(e) => setEditLabelText(e.target.value)}
                              className="bg-black/80 border border-cyan-400 px-1.5 py-0.5 rounded text-cyan-200 text-xs font-bold w-full"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(w.deviceId);
                                if (e.key === 'Escape') setEditingDeviceId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRename(w.deviceId)}
                              className="p-1 rounded bg-cyan-500 text-black cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0">
                            <div className="font-bold text-cyan-200 truncate flex items-center gap-1.5">
                              <span className="truncate">{w.label}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingDeviceId(w.deviceId);
                                  setEditLabelText(w.label);
                                }}
                                className="text-[10px] text-cyan-400/60 hover:text-cyan-200 cursor-pointer"
                                title="Rename Callsign"
                              >
                                ✎
                              </button>
                            </div>
                            <div className="text-[10px] text-emerald-400/60 truncate">
                              ID: {w.deviceId.slice(-6)}
                              {activeContact
                                ? ` • ${activeContact.distanceMeters}m (${activeContact.smoothedRssi}dBm)`
                                : ' • Offline / Out of range'}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {activeContact && onSnapContactAhead && (
                          <button
                            type="button"
                            onClick={() => onSnapContactAhead(w.deviceId)}
                            className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-[10px] cursor-pointer"
                            title="Aim straight ahead"
                          >
                            AIM
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onRemoveWhitelist(w.deviceId);
                            showToast(`Removed "${w.label}" from squad.`);
                          }}
                          className="px-2 py-0.5 rounded bg-red-950/80 hover:bg-red-900 border border-red-500/50 text-red-200 text-[10px] font-bold cursor-pointer"
                        >
                          UNCLAIM
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ===============================================================
              3. UNCLAIMED NEARBY DEVICES (1-Tap Mark as Ally)
             =============================================================== */}
          {contacts.filter((c) => !c.isFriendly).length > 0 && (
            <div className="space-y-1.5">
              <span className="font-mono text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>UNCLAIMED DEVICES IN RANGE ({contacts.filter((c) => !c.isFriendly).length})</span>
              </span>

              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {contacts
                  .filter((c) => !c.isFriendly)
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-black/40 border border-emerald-500/20 font-mono text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-bold text-emerald-200 truncate">{c.name}</div>
                        <div className="text-[10px] text-emerald-400/70">
                          {c.distanceMeters}m • {c.smoothedRssi}dBm • {Math.round(c.estimatedBearingDeg)}°
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onCalibrateOneMeter && (
                          <button
                            type="button"
                            onClick={() => onCalibrateOneMeter(c.id)}
                            className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-[10px] cursor-pointer"
                            title="Calibrate at 1 meter"
                          >
                            1m CAL
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            onWhitelistContact(c);
                            showToast(`Claimed "${c.name}" as Ally.`);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black border border-cyan-300 text-[10px] font-bold cursor-pointer"
                        >
                          + CLAIM ALLY
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* ===============================================================
              4. MANUAL REGISTRATION (By Bluetooth ID or Custom Callsign)
             =============================================================== */}
          <form
            onSubmit={handleManualAdd}
            className="p-3 rounded-xl bg-black/50 border border-emerald-500/25 space-y-2"
          >
            <span className="font-mono text-xs font-bold text-emerald-300 flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>MANUALLY REGISTER TEAMMATE</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Device Name / MAC ID (e.g. SIG-7A, Watch)"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                className="bg-[#050e09] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-100 placeholder-emerald-600 font-mono outline-none focus:border-cyan-400"
              />
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="Callsign (e.g. VIPER)"
                  value={manualCallsign}
                  onChange={(e) => setManualCallsign(e.target.value)}
                  className="bg-[#050e09] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-100 placeholder-emerald-600 font-mono outline-none focus:border-cyan-400 flex-1 min-w-0"
                />
                <button
                  type="submit"
                  disabled={!manualId.trim()}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-black font-mono font-bold text-xs shrink-0 cursor-pointer"
                >
                  ADD
                </button>
              </div>
            </div>
          </form>

        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#0a1f14] border-t border-emerald-500/30 flex items-center justify-between">
          <span className="text-[10px] font-mono text-emerald-400/70">
            Encrypted Squad P2P syncs allies to team automatically.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-extrabold cursor-pointer transition shadow"
          >
            DONE
          </button>
        </div>

      </div>
    </div>
  );
};
