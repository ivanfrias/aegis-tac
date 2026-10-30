import React, { useState } from 'react';
import { User, Check, X, Sparkles, Shield } from 'lucide-react';

interface CallsignModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCallsign: string;
  onSaveCallsign: (newCallsign: string) => void;
}

const TACTICAL_CALLSIGNS = [
  'ALPHA-1',
  'BRAVO-2',
  'CHARLIE-3',
  'DELTA-4',
  'GHOST',
  'VIPER',
  'REAPER',
  'SHADOW',
  'TITAN',
  'ROGUE',
  'SPECTER',
  'HUNTER',
  'FALCON',
  'COBRA',
  'WOLFPACK',
  'APEX',
];

export const CallsignModal: React.FC<CallsignModalProps> = ({
  isOpen,
  onClose,
  currentCallsign,
  onSaveCallsign,
}) => {
  const [callsignInput, setCallsignInput] = useState(currentCallsign);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = callsignInput.trim().toUpperCase() || 'OPERATOR';
    onSaveCallsign(clean);
    onClose();
  };

  const handleSelectPreset = (preset: string) => {
    setCallsignInput(preset);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-sm rounded-2xl bg-[#07130c] border border-emerald-500/40 shadow-[0_0_50px_rgba(16,185,129,0.25)] flex flex-col overflow-hidden text-emerald-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-500/25 bg-[#0a1b11]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-mono text-xs font-black tracking-wider uppercase text-emerald-300">
                Operator Callsign
              </h3>
              <p className="text-[10px] font-mono text-emerald-400/60">
                Set or re-set your in-match name live
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-400/70 hover:text-emerald-200 hover:bg-emerald-950/80 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3.5">
          <div>
            <label className="block text-[10px] font-mono text-emerald-400/80 uppercase font-bold mb-1">
              Your Callsign
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                value={callsignInput}
                onChange={(e) => setCallsignInput(e.target.value.toUpperCase())}
                placeholder="CALLSIGN"
                maxLength={12}
                autoFocus
                className="w-full bg-black/80 border-2 border-emerald-500/50 rounded-xl px-3 py-2.5 font-mono text-base font-extrabold text-emerald-200 tracking-wider focus:outline-none focus:border-emerald-400 shadow-inner"
              />
              <span className="absolute right-3 font-mono text-xs text-emerald-500/60 font-semibold">
                {callsignInput.length}/12
              </span>
            </div>
          </div>

          {/* Live Preview Badge */}
          <div className="p-2.5 rounded-xl bg-black/60 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-[10px] font-mono text-emerald-400/60 uppercase">
              HUD Preview:
            </span>
            <div className="flex items-center gap-1.5 font-mono text-xs font-black text-emerald-300 bg-emerald-950/80 border border-emerald-400/60 px-2.5 py-1 rounded-lg shadow-sm">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>{callsignInput.trim().toUpperCase() || 'OPERATOR'}</span>
              <span className="text-[9px] text-emerald-400/70">[📱⌚]</span>
            </div>
          </div>

          {/* Quick Tactical Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-emerald-400/80 uppercase font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Tactical Presets</span>
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {TACTICAL_CALLSIGNS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={`px-1.5 py-1 rounded-lg font-mono text-[10px] font-bold border transition cursor-pointer truncate ${
                    callsignInput.toUpperCase() === preset
                      ? 'bg-emerald-500 text-black border-emerald-200 font-black shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : 'bg-[#08170e] hover:bg-emerald-950/80 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-emerald-500/20">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl bg-black/60 hover:bg-zinc-900 border border-zinc-700 text-zinc-300 font-mono text-xs font-bold cursor-pointer transition"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-black flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.4)] cursor-pointer transition active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>SET CALLSIGN</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
