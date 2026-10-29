import React, { useState } from 'react';
import {
  X,
  Radar,
  Bluetooth,
  Shield,
  Skull,
  HeartPulse,
  Crosshair,
  AlertTriangle,
  Flag,
  Map as MapIcon,
  Compass,
  Users,
  Lock,
  Radio,
  PlusCircle,
  Eye,
  Wrench,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  BookOpen,
} from 'lucide-react';

interface FieldManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FieldManualModal: React.FC<FieldManualModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [mode, setMode] = useState<'TOUR' | 'BUTTONS' | 'SETUP'>('TOUR');
  const [step, setStep] = useState(0);
  const [copiedFlag, setCopiedFlag] = useState(false);

  if (!isOpen) return null;

  const copyChromeFlag = () => {
    navigator.clipboard?.writeText(
      'chrome://flags/#enable-experimental-web-platform-features'
    );
    setCopiedFlag(true);
    setTimeout(() => setCopiedFlag(false), 2000);
  };

  const tourSteps = [
    {
      title: '1. Welcome to AegisTac BLE Radar',
      subtitle: 'Tactical Proximity & Encrypted Squad HUD',
      content: (
        <div className="space-y-3 text-xs font-mono text-emerald-100/90">
          <p>
            <strong>AegisTac</strong> turns your smartphone into a wrist- or
            rig-mounted airsoft radar that detects nearby Bluetooth Low Energy
            (BLE) signals and links your squad over encrypted peer-to-peer
            WebRTC.
          </p>
          <div className="bg-emerald-950/50 border border-emerald-500/35 rounded-xl p-3 space-y-2">
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <Radar className="w-4 h-4" />
              <span>How Targets Are Plotted:</span>
            </div>
            <ul className="space-y-1.5 text-[11px]">
              <li className="flex items-start gap-2">
                <span className="w-2.5 h-1.5 rounded bg-amber-400 mt-1 shrink-0" />
                <span>
                  <strong>Bogey Arcs (Red/Amber):</strong> Unknown nearby
                  Bluetooth devices (phones, watches, action cams). The arc
                  shows estimated distance (via signal strength) and whether
                  they are <strong>▲ CLOSING</strong> or <strong>▼ MOVING AWAY</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rotate-45 bg-cyan-400 mt-1 shrink-0" />
                <span>
                  <strong>Ally BLE Diamonds (Cyan):</strong> Bluetooth devices
                  you marked as friendly teammates (`+ALLY`) so they don't
                  trigger bogey alerts.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-sky-400 mt-1 shrink-0" />
                <span>
                  <strong>Squad GPS Dots (Blue):</strong> Teammates linked to
                  your encrypted Squad Room sharing live GPS & status.
                </span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      title: '2. Basic HUD vs. Advanced Screen',
      subtitle: 'Two Screens Built for Staging & Combat',
      content: (
        <div className="space-y-3 text-xs font-mono text-emerald-100/90">
          <p>
            Use the big switcher bar at the top of the app to toggle between two
            views:
          </p>
          <div className="bg-black/50 border border-emerald-500/35 rounded-xl p-2.5 space-y-1">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              <span>BASIC HUD (In-Game Combat View)</span>
            </div>
            <p className="text-[11px] text-emerald-100/80">
              Zero clutter for when you have gloves and eyepro on. Shows the
              closest threat banner, 1-tap <strong>SCAN</strong> &{' '}
              <strong>SIM</strong> toggles, the 360° radar, and 6 large buttons
              at the bottom to broadcast your status (<strong>IN PLAY</strong>,{' '}
              <strong>HIT / OUT</strong>, <strong>MEDIC!</strong>) or drop
              tactical pings.
            </p>
          </div>

          <div className="bg-black/50 border border-cyan-500/35 rounded-xl p-2.5 space-y-1">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Wrench className="w-4 h-4" />
              <span>ADVANCED (Staging Area & Setup)</span>
            </div>
            <p className="text-[11px] text-emerald-100/80">
              Inspect every detected BLE signal's dBm & bearing, whitelist
              teammates' devices as <strong>+ALLY</strong>, set your{' '}
              <strong>Callsign, Room Code & Secret AES-256 PIN</strong>, and
              calibrate environment presets (<strong>CQB 20m</strong>,{' '}
              <strong>COMPOUND 40m</strong>, <strong>WOODLAND 75m</strong>).
            </p>
          </div>
        </div>
      ),
    },
    {
      title: '3. Enabling Bluetooth on Your Phone',
      subtitle: '1-Time Browser Setup for Passive BLE Scanning',
      content: (
        <div className="space-y-3 text-xs font-mono text-emerald-100/90">
          <div className="bg-emerald-950/50 border border-emerald-500/40 rounded-xl p-2.5 space-y-1.5">
            <div className="font-bold text-emerald-300">
              Android & Desktop (Google Chrome):
            </div>
            <p className="text-[11px] text-emerald-100/80">
              To allow continuous passive Bluetooth radar sweeps, copy this flag
              URL, paste it into Chrome's address bar, set it to{' '}
              <strong>Enabled</strong>, and relaunch Chrome:
            </p>
            <div className="flex items-center gap-1.5 bg-black/70 p-1.5 rounded-lg border border-amber-500/40">
              <code className="text-[10px] text-amber-300 break-all flex-1">
                chrome://flags/#enable-experimental-web-platform-features
              </code>
              <button
                onClick={copyChromeFlag}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] px-2 py-1 rounded flex items-center gap-1 shrink-0 cursor-pointer"
              >
                {copiedFlag ? (
                  <>
                    <Check className="w-3 h-3" />
                    <span>COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>COPY</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-cyan-950/40 border border-cyan-500/35 rounded-xl p-2.5 space-y-1">
            <div className="font-bold text-cyan-300">iOS / iPhone:</div>
            <p className="text-[11px] text-emerald-100/80">
              Apple Safari blocks Web Bluetooth. Install the free{' '}
              <strong>Bluefy – Web BLE Browser</strong> from the iOS App Store
              and open this URL inside Bluefy.
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 select-none">
      <div className="bg-[#07130d] border border-emerald-500/40 rounded-2xl w-full max-w-lg max-h-[90dvh] flex flex-col shadow-[0_0_30px_rgba(16,185,129,0.25)] overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-3 bg-[#050b07] border-b border-emerald-500/25 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span className="font-mono text-xs sm:text-sm font-extrabold tracking-wider text-emerald-200 uppercase">
              AegisTac // Field Manual & Guide
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-Navigation Tabs inside Modal */}
        <div className="grid grid-cols-3 gap-1 p-2 bg-[#060f0a] border-b border-emerald-500/20 font-mono text-[11px] font-bold">
          <button
            onClick={() => setMode('TOUR')}
            className={`py-1.5 rounded-lg cursor-pointer transition ${
              mode === 'TOUR'
                ? 'bg-emerald-500 text-black'
                : 'text-emerald-300/70 hover:text-emerald-200'
            }`}
          >
            QUICK TOUR
          </button>
          <button
            onClick={() => setMode('BUTTONS')}
            className={`py-1.5 rounded-lg cursor-pointer transition ${
              mode === 'BUTTONS'
                ? 'bg-emerald-500 text-black'
                : 'text-emerald-300/70 hover:text-emerald-200'
            }`}
          >
            BUTTON GUIDE
          </button>
          <button
            onClick={() => setMode('SETUP')}
            className={`py-1.5 rounded-lg cursor-pointer transition ${
              mode === 'SETUP'
                ? 'bg-emerald-500 text-black'
                : 'text-emerald-300/70 hover:text-emerald-200'
            }`}
          >
            BLE & RANGE
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {mode === 'TOUR' && (
            <div className="space-y-3">
              <div>
                <div className="text-xs font-mono text-emerald-400 font-bold">
                  {tourSteps[step].title}
                </div>
                <div className="text-[11px] font-mono text-emerald-300/60">
                  {tourSteps[step].subtitle}
                </div>
              </div>

              {tourSteps[step].content}

              {/* Step Dots */}
              <div className="flex items-center justify-center gap-1.5 pt-2">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setStep(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === step
                        ? 'w-6 bg-emerald-400'
                        : 'w-2 bg-emerald-500/30'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {mode === 'BUTTONS' && (
            <div className="space-y-2.5 text-xs font-mono">
              <div className="text-[11px] text-emerald-300/80 mb-1">
                Complete reference of what every control in the app does:
              </div>

              {/* Scanning & Sim */}
              <div className="bg-black/45 border border-emerald-500/25 rounded-xl p-2.5 space-y-2">
                <div className="text-emerald-300 font-bold text-[11px] uppercase">
                  Radar & Bluetooth Controls
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-emerald-600 text-black font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1">
                    <Radio className="w-3 h-3" /> SCAN / BLE SWEEP
                  </span>
                  <span className="text-emerald-100/80">
                    Starts passive Web Bluetooth scanning for nearby devices and
                    plots them by RSSI distance.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-amber-500/25 border border-amber-400 text-amber-200 font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0">
                    SIM: OFF / ON
                  </span>
                  <span className="text-emerald-100/80">
                    Toggles 3 synthetic moving targets (`5m–35m`) so you can
                    test and practice with the radar before a match.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-cyan-950 border border-cyan-500/40 text-cyan-200 font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1">
                    <PlusCircle className="w-3 h-3" /> PAIR TAG / +ALLY
                  </span>
                  <span className="text-emerald-100/80">
                    Pairs a specific Bluetooth device or marks a detected signal
                    as a Friendly teammate (`+ALLY`), syncing it to your squad.
                  </span>
                </div>
              </div>

              {/* Map & Orientation */}
              <div className="bg-black/45 border border-emerald-500/25 rounded-xl p-2.5 space-y-2">
                <div className="text-emerald-300 font-bold text-[11px] uppercase">
                  Map & Compass Controls
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 px-1.5 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1">
                    <MapIcon className="w-3 h-3" /> MAP ON / SAT / TOPO
                  </span>
                  <span className="text-emerald-100/80">
                    Shows or hides the Satellite or Topographic map underneath
                    the radar rings.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-black border border-emerald-500/30 text-emerald-300 px-1.5 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1">
                    <Compass className="w-3 h-3" /> HEAD-UP / NORTH-UP
                  </span>
                  <span className="text-emerald-100/80">
                    <strong>HEAD-UP</strong> rotates the radar & map with your
                    phone's compass so straight ahead is always up.{' '}
                    <strong>NORTH-UP</strong> locks North to the top.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-emerald-500/20 border border-emerald-400/50 text-emerald-200 px-1.5 py-0.5 rounded text-[10px] shrink-0 font-bold">
                    RANGE: 20m / 40m / 75m
                  </span>
                  <span className="text-emerald-100/80">
                    Changes the outer radius of the radar and adjusts the
                    satellite zoom level (`CQB 20m`, `COMPOUND 40m`, `WOODLAND 75m`).
                  </span>
                </div>
              </div>

              {/* Player Status & Tactical Pings */}
              <div className="bg-black/45 border border-emerald-500/25 rounded-xl p-2.5 space-y-2">
                <div className="text-emerald-300 font-bold text-[11px] uppercase">
                  Player Status & Tactical Pings
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-emerald-500 text-black font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> IN PLAY /{' '}
                    <Skull className="w-3 h-3" /> HIT /{' '}
                    <HeartPulse className="w-3 h-3" /> MEDIC!
                  </span>
                  <span className="text-emerald-100/80">
                    Broadcasts your live status to all teammates in your Squad
                    Room. <strong>MEDIC!</strong> flashes a red alert ring on
                    teammates' radars.
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-red-950 border border-red-500/50 text-red-200 font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1">
                    <Crosshair className="w-3 h-3" /> ! ENEMY /{' '}
                    <AlertTriangle className="w-3 h-3" /> DANGER /{' '}
                    <Flag className="w-3 h-3" /> OBJ
                  </span>
                  <span className="text-emerald-100/80">
                    <strong>Tap once</strong> then tap anywhere on the radar
                    circle to drop a 45-second marker at that exact bearing &
                    distance. <strong>Double-tap</strong> the button to
                    instantly drop a marker 20m straight ahead of you!
                  </span>
                </div>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="bg-cyan-500 text-black font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0 flex items-center gap-1">
                    <Users className="w-3 h-3" /> SQUAD +{' '}
                    <Lock className="w-3 h-3" /> AES-256 PIN
                  </span>
                  <span className="text-emerald-100/80">
                    Enter the same <strong>Room Code</strong> and secret{' '}
                    <strong>PIN</strong> as your teammates in{' '}
                    <code>ADVANCED → SQUAD</code> to link phones peer-to-peer
                    with AES-256 encryption.
                  </span>
                </div>
              </div>
            </div>
          )}

          {mode === 'SETUP' && (
            <div className="space-y-3 text-xs font-mono text-emerald-100/90">
              <div className="bg-black/45 border border-emerald-500/25 rounded-xl p-3 space-y-2">
                <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                  <Bluetooth className="w-4 h-4" />
                  <span>Expected Bluetooth Detection Range</span>
                </div>
                <ul className="space-y-1.5 text-[11px]">
                  <li>
                    • <strong>CQB Indoors (20m preset):</strong> 5m – 20m
                    through drywall/plywood corners and hallways.
                  </li>
                  <li>
                    • <strong>Urban Compound (40m preset):</strong> 15m – 35m
                    across courtyards, doorways, and structures.
                  </li>
                  <li>
                    • <strong>Woodland / Field (75m preset):</strong> 25m – 60m+
                    with line-of-sight (wet foliage absorbs 2.4 GHz slightly).
                  </li>
                </ul>
              </div>

              <div className="bg-emerald-950/40 border border-emerald-500/35 rounded-xl p-3 space-y-2">
                <div className="font-bold text-emerald-300">
                  Chrome Web Bluetooth Flag (Android / Desktop):
                </div>
                <div className="flex items-center gap-1.5 bg-black/70 p-1.5 rounded-lg border border-amber-500/40">
                  <code className="text-[10px] text-amber-300 break-all flex-1">
                    chrome://flags/#enable-experimental-web-platform-features
                  </code>
                  <button
                    onClick={copyChromeFlag}
                    className="bg-amber-500 hover:bg-amber-400 text-black font-bold text-[10px] px-2 py-1 rounded flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    {copiedFlag ? 'COPIED' : 'COPY'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-[#050b07] border-t border-emerald-500/25 flex items-center justify-between gap-2 font-mono text-xs">
          {mode === 'TOUR' ? (
            <>
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border cursor-pointer ${
                  step === 0
                    ? 'border-emerald-500/15 text-emerald-500/30 cursor-not-allowed'
                    : 'border-emerald-500/35 text-emerald-300 hover:bg-emerald-950/50'
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>BACK</span>
              </button>

              {step < tourSteps.length - 1 ? (
                <button
                  onClick={() =>
                    setStep((s) => Math.min(tourSteps.length - 1, s + 1))
                  }
                  className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-black font-bold px-4 py-1.5 rounded-lg cursor-pointer"
                >
                  <span>NEXT</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => setMode('BUTTONS')}
                  className="flex items-center gap-1 bg-cyan-400 hover:bg-cyan-300 text-black font-bold px-4 py-1.5 rounded-lg cursor-pointer"
                >
                  <span>VIEW BUTTON GUIDE</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-2 rounded-lg cursor-pointer"
            >
              GOT IT — RETURN TO RADAR
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
