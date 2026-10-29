import React, { useState } from 'react';
import {
  Bluetooth,
  ShieldCheck,
  ShieldAlert,
  Radio,
  PlusCircle,
  Info,
  Crosshair,
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
  onStartPassiveScan: () => void;
  onStopScan: () => void;
  onPickDevice: () => void;
  onToggleSimulation: (enabled: boolean) => void;
  onWhitelistContact: (contact: BleContact, customCallsign?: string) => void;
  onRemoveWhitelist: (deviceId: string) => void;
  onSnapContactAhead?: (deviceId: string) => void;
}

export const BleContactsList: React.FC<BleContactsListProps> = ({
  contacts,
  capabilities,
  isScanning,
  scanStatusText,
  simEnabled,
  onStartPassiveScan,
  onStopScan,
  onPickDevice,
  onToggleSimulation,
  onWhitelistContact,
  onRemoveWhitelist,
  onSnapContactAhead,
}) => {
  const [showCompatHelp, setShowCompatHelp] = useState(false);

  const bogeyCount = contacts.filter((c) => !c.isFriendly).length;
  const friendlyCount = contacts.filter((c) => c.isFriendly).length;

  return (
    <div className="bg-[#08140e]/95 border border-emerald-500/25 rounded-xl p-2.5 flex flex-col gap-2">
      {/* Header & Scanner Badges */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Bluetooth className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-emerald-200">
            BLE Contacts
          </span>
          <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono px-1.5 py-0.5 rounded">
            {bogeyCount} BOGEY
          </span>
          <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono px-1.5 py-0.5 rounded">
            {friendlyCount} ALLY
          </span>
        </div>

        <button
          onClick={() => setShowCompatHelp((v) => !v)}
          className="text-emerald-400/80 hover:text-emerald-300 text-[11px] font-mono flex items-center gap-1 cursor-pointer"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Setup</span>
        </button>
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
            Web Bluetooth Field Setup:
          </div>
          <p className="text-emerald-100/80">
            • <strong>Android/Desktop Chrome:</strong> Enable passive sweep at:
            <code className="block bg-black/60 text-amber-300 p-1 mt-0.5 rounded select-all break-all">
              chrome://flags/#enable-experimental-web-platform-features
            </code>
          </p>
          <p className="text-emerald-100/80">
            • <strong>iOS:</strong> Open this URL in the free <strong>Bluefy – Web BLE Browser</strong> app.
          </p>
        </div>
      )}

      {/* Contacts List */}
      <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5">
        {contacts.length === 0 ? (
          <div className="text-center py-3 text-[11px] font-mono text-emerald-500/50">
            No BLE signals in range. Start Sweep or enable Sim.
          </div>
        ) : (
          contacts.map((contact) => {
            const isClose = contact.distanceMeters <= 12;
            return (
              <div
                key={contact.id}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg border font-mono text-[11px] ${
                  contact.isFriendly
                    ? 'bg-cyan-950/35 border-cyan-500/40 text-cyan-100'
                    : isClose
                    ? 'bg-red-950/40 border-red-500/50 text-red-100'
                    : 'bg-amber-950/25 border-amber-500/35 text-amber-100'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {contact.isFriendly ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  ) : (
                    <ShieldAlert
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isClose ? 'text-red-400 animate-pulse' : 'text-amber-400'
                      }`}
                    />
                  )}
                  <div className="truncate">
                    <div className="font-bold truncate">
                      {contact.assignedCallsign || contact.name}
                    </div>
                    <div className="text-[9px] opacity-75 truncate">
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
