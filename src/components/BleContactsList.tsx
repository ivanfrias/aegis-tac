import React, { useState } from 'react';
import {
  Bluetooth,
  ShieldCheck,
  ShieldAlert,
  Radio,
  PlusCircle,
  Info,
  Crosshair,
  Users,
} from 'lucide-react';
import { BleContact, WhitelistedDevice } from '../types/radar';
import { BleCapabilities } from '../services/bleScanner';

interface BleContactsListProps {
  contacts: BleContact[];
  whitelist: WhitelistedDevice[];
  capabilities: BleCapabilities;
  isScanning: boolean;
  scanStatusText: string;
  simEnabled: boolean;
  bleOnlyMode: boolean;
  onToggleBleOnlyMode: () => void;
  onStartPassiveScan: () => void;
  onStopScan: () => void;
  onPickDevice: () => void;
  onToggleSimulation: (enabled: boolean) => void;
  onWhitelistContact: (contact: BleContact, customCallsign?: string) => void;
  onRemoveWhitelist: (deviceId: string) => void;
  onSnapContactAhead?: (deviceId: string) => void;
  onCalibrateOneMeter?: (deviceId: string) => void;
  onOpenFriendlyRegistry?: () => void;
  onClaimProximity?: (maxDistanceMeters: number) => number;
}

export const BleContactsList: React.FC<BleContactsListProps> = ({
  contacts,
  capabilities,
  isScanning,
  scanStatusText,
  simEnabled,
  bleOnlyMode,
  onToggleBleOnlyMode,
  onStartPassiveScan,
  onStopScan,
  onPickDevice,
  onToggleSimulation,
  onWhitelistContact,
  onRemoveWhitelist,
  onSnapContactAhead,
  onCalibrateOneMeter,
  onOpenFriendlyRegistry,
  onClaimProximity,
}) => {
  const [showCompatHelp, setShowCompatHelp] = useState(false);
  const [filterType, setFilterType] = useState<'ALL' | 'BOGEY' | 'ALLY'>('ALL');

  const bogeyCount = contacts.filter((c) => !c.isFriendly).length;
  const friendlyCount = contacts.filter((c) => c.isFriendly).length;
  const filteredContacts = contacts.filter((c) => {
    if (filterType === 'BOGEY') return !c.isFriendly;
    if (filterType === 'ALLY') return c.isFriendly;
    return true;
  });

  return (
    <div className="bg-[#08140e]/95 border border-emerald-500/25 rounded-xl p-2.5 flex flex-col gap-2">
      {/* Header & Scanner Badges */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Bluetooth className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <button
            type="button"
            onClick={() => setFilterType('ALL')}
            className={`font-mono text-[11px] font-bold tracking-wider uppercase cursor-pointer ${
              filterType === 'ALL'
                ? 'text-emerald-200 underline decoration-emerald-400'
                : 'text-emerald-400/70 hover:text-emerald-200'
            }`}
          >
            ALL ({contacts.length})
          </button>
          <button
            type="button"
            onClick={() =>
              setFilterType((f) => (f === 'BOGEY' ? 'ALL' : 'BOGEY'))
            }
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-pointer ${
              filterType === 'BOGEY'
                ? 'bg-amber-400 text-black border-amber-200 font-bold'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
            }`}
          >
            {bogeyCount} BOGEY
          </button>
          <button
            type="button"
            onClick={() =>
              setFilterType((f) => (f === 'ALLY' ? 'ALL' : 'ALLY'))
            }
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded border cursor-pointer ${
              filterType === 'ALLY'
                ? 'bg-cyan-400 text-black border-cyan-200 font-bold'
                : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
            }`}
          >
            {friendlyCount} ALLY
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onToggleBleOnlyMode}
            className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold flex items-center gap-1 cursor-pointer transition ${
              bleOnlyMode
                ? 'bg-cyan-400 text-black border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.4)]'
                : 'bg-black/50 border-emerald-500/30 text-emerald-300/80 hover:text-emerald-200'
            }`}
            title="Show only Bluetooth (BLE) devices on the radar (hides Squad GPS dots)"
          >
            <Bluetooth className="w-3 h-3" />
            <span>{bleOnlyMode ? 'BLE ONLY: ON' : 'BLE ONLY: OFF'}</span>
          </button>

          <button
            onClick={() => setShowCompatHelp((v) => !v)}
            className="text-emerald-400/80 hover:text-emerald-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Setup</span>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        {!isScanning ? (
          <button
            onClick={onStartPassiveScan}
            className="flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-black font-mono font-bold text-[10px] sm:text-xs py-1.5 px-2 rounded-lg transition cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">BLE SWEEP</span>
          </button>
        ) : (
          <button
            onClick={onStopScan}
            className="flex items-center justify-center gap-1 bg-red-600/80 hover:bg-red-500 text-white font-mono font-bold text-[10px] sm:text-xs py-1.5 px-2 rounded-lg transition cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 animate-ping shrink-0" />
            <span className="truncate">STOP</span>
          </button>
        )}

        <button
          onClick={onPickDevice}
          className="flex items-center justify-center gap-1 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 font-mono text-[10px] sm:text-xs py-1.5 px-2 rounded-lg transition cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">PAIR TAG</span>
        </button>

        <button
          onClick={() => onToggleSimulation(!simEnabled)}
          className={`flex items-center justify-center gap-1 border font-mono text-[10px] sm:text-xs py-1.5 px-2 rounded-lg transition cursor-pointer ${
            simEnabled
              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300/80 hover:text-emerald-200'
          }`}
        >
          <span className="truncate">
            {simEnabled ? 'SIM: ON' : 'SIM: OFF'}
          </span>
        </button>
      </div>

      {/* Status Line */}
      <div className="text-[10px] font-mono text-emerald-300/75 bg-black/40 px-2 py-1 rounded border border-emerald-500/15 flex items-center justify-between gap-2">
        <span className="truncate">{scanStatusText}</span>
        <span className="text-[9px] text-emerald-400/60 shrink-0">
          {capabilities.hasLEScan
            ? 'LE-SCAN'
            : capabilities.hasWebBluetooth
            ? 'PICKER'
            : 'SIM'}
        </span>
      </div>

      {/* Web Bluetooth Compatibility Drawer */}
      {showCompatHelp && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-lg p-2 text-[10px] font-mono text-emerald-200 space-y-1">
          <div className="font-bold text-emerald-300">
            Web Bluetooth Field Setup &amp; Smartwatch Tips:
          </div>
          <p className="text-emerald-100/80">
            • <strong>Smartwatch already paired to your phone?</strong> When a watch (like Galaxy Watch 5) is already connected to your phone, it stops broadcasting public BLE beacons until you open <strong>Settings → Connections → Bluetooth</strong> on the watch screen (or scan it from a second phone/laptop).
          </p>
          <p className="text-emerald-100/80">
            • <strong>Touch-to-Identify:</strong> Hold your watch/tag right against your phone—it will jump to the very top of the list as <strong>#1 CLOSEST (&lt;1m)</strong> and show its brand (e.g. <code>Samsung</code> / <code>WearOS</code>).
          </p>
          <p className="text-emerald-100/80">
            • <strong>Android/Desktop Chrome Flag:</strong>
            <code className="block bg-black/60 text-amber-300 p-1 mt-0.5 rounded select-all break-all">
              chrome://flags/#enable-experimental-web-platform-features
            </code>
          </p>
        </div>
      )}

      {/* Proximity Claim & Friendly Squad Toolbar */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => onClaimProximity?.(8)}
          className="flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-mono font-black text-[11px] py-1.5 px-2 rounded-lg shadow-[0_0_10px_rgba(34,211,238,0.35)] cursor-pointer active:scale-95 transition"
          title="At pre-game staging, claim all devices within 8m as Friendly Squad"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>CLAIM SQUAD (&lt;8m)</span>
        </button>

        <button
          type="button"
          onClick={onOpenFriendlyRegistry}
          className="flex items-center justify-center gap-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-400/50 text-emerald-200 font-mono font-bold text-[11px] py-1.5 px-2 rounded-lg cursor-pointer transition"
          title="Open Friendly Team Registry and manual claim settings"
        >
          <Users className="w-3.5 h-3.5 text-cyan-400" />
          <span>REGISTRY ({friendlyCount})</span>
        </button>
      </div>

      {/* Contacts List */}
      <div className="max-h-44 overflow-y-auto space-y-1 pr-0.5">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-3 text-[11px] font-mono text-emerald-500/50">
            No BLE signals in range. Start Sweep or enable Sim.
          </div>
        ) : (
          filteredContacts.map((contact, idx) => {
            const isSquad = contact.affiliation === 'SQUAD';
            const isFriendly = contact.affiliation === 'FRIENDLY' || (contact.isFriendly && !isSquad);
            const isClose = contact.distanceMeters <= 12;
            const isClosestTouching = idx === 0 && contact.distanceMeters <= 1.8;
            return (
              <div
                key={contact.id}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border font-mono text-[11px] ${
                  isSquad
                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-100'
                    : isFriendly
                    ? 'bg-blue-950/40 border-blue-500/50 text-blue-100'
                    : isClose
                    ? 'bg-red-950/40 border-red-500/50 text-red-100'
                    : 'bg-orange-950/30 border-orange-500/40 text-orange-100'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isSquad ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : isFriendly ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  ) : (
                    <ShieldAlert
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isClose ? 'text-red-400 animate-pulse' : 'text-orange-400'
                      }`}
                    />
                  )}
                  <div className="truncate">
                    <div className="font-bold truncate flex items-center gap-1">
                      <span className="truncate">
                        {contact.assignedCallsign || contact.name}
                      </span>
                      {contact.fusedDeviceCount && contact.fusedDeviceCount > 1 && (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-500/30 border border-emerald-400/60 text-emerald-200 font-extrabold shrink-0">
                          📱⌚ {contact.fusedDeviceCount} DEV
                        </span>
                      )}
                      {isClosestTouching && (
                        <span className="text-[8px] px-1 py-0.2 rounded bg-emerald-400 text-black font-extrabold shrink-0">
                          CLOSEST
                        </span>
                      )}
                    </div>
                    <div className="text-[9px] opacity-75 truncate">
                      {isSquad
                        ? '🛡 SQUAD • '
                        : isFriendly
                        ? '🔷 ALLY • '
                        : '⚠ BOGEY • '}
                      {contact.smoothedRssi}dBm • {Math.round(contact.estimatedBearingDeg)}° •{' '}
                      {contact.trend === 'APPROACHING'
                        ? '▲ CLOSING'
                        : contact.trend === 'RECEDING'
                        ? '▼ AWAY'
                        : '• STABLE'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-bold text-xs">
                    {contact.distanceMeters}m
                  </span>

                  {onCalibrateOneMeter && (
                    <button
                      onClick={() => onCalibrateOneMeter(contact.id)}
                      className="bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                      title="Hold this device ~1 meter away and tap 1m CAL to calibrate exact distance for its antenna"
                    >
                      1m CAL
                    </button>
                  )}

                  {onSnapContactAhead && (
                    <button
                      onClick={() => onSnapContactAhead(contact.id)}
                      className="bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/50 text-emerald-200 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5 cursor-pointer"
                      title="Point your phone at this device and tap AIM to align its direction straight ahead"
                    >
                      <Crosshair className="w-2.5 h-2.5" />
                      <span>AIM</span>
                    </button>
                  )}

                  {!contact.isFriendly ? (
                    <button
                      onClick={() => onWhitelistContact(contact)}
                      className="bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-200 text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      +ALLY
                    </button>
                  ) : (
                    <button
                      onClick={() => onRemoveWhitelist(contact.id)}
                      className="bg-red-500/20 hover:bg-red-500/35 border border-red-400/40 text-red-200 text-[9px] px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      UNMARK
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
