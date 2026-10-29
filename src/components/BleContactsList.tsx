import React, { useState } from 'react';
import {
  Bluetooth,
  ShieldCheck,
  ShieldAlert,
  Radio,
  PlusCircle,
  Info,
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
}) => {
  const [showCompatHelp, setShowCompatHelp] = useState(false);

  const bogeyCount = contacts.filter((c) => !c.isFriendly).length;
  const friendlyCount = contacts.filter((c) => c.isFriendly).length;

  return (
    <div className="bg-[#08140e]/90 border border-emerald-500/25 rounded-xl p-3 flex flex-col gap-3">
      {/* Header & Scanner Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bluetooth className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-bold tracking-wider uppercase text-emerald-200">
            BLE Proximity Contacts
          </span>
          <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono px-1.5 py-0.5 rounded">
            {bogeyCount} BOGEYS
          </span>
          <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-mono px-1.5 py-0.5 rounded">
            {friendlyCount} FRIENDLY
          </span>
        </div>

        <button
          onClick={() => setShowCompatHelp((v) => !v)}
          className="text-emerald-400/80 hover:text-emerald-300 text-xs font-mono flex items-center gap-1"
          title="Web Bluetooth Setup Guide"
        >
          <Info className="w-3.5 h-3.5" />
          <span>BLE Setup</span>
        </button>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {!isScanning ? (
          <button
            onClick={onStartPassiveScan}
            className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-black font-mono font-bold text-xs py-2 px-3 rounded-lg transition cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>START BLE SWEEP</span>
          </button>
        ) : (
          <button
            onClick={onStopScan}
            className="flex items-center justify-center gap-1.5 bg-red-600/80 hover:bg-red-500 text-white font-mono font-bold text-xs py-2 px-3 rounded-lg transition cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5 animate-ping" />
            <span>STOP BLE SWEEP</span>
          </button>
        )}

        <button
          onClick={onPickDevice}
          className="flex items-center justify-center gap-1.5 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 text-cyan-200 font-mono text-xs py-2 px-3 rounded-lg transition cursor-pointer"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>PAIR BEACON</span>
        </button>

        <button
          onClick={() => onToggleSimulation(!simEnabled)}
          className={`col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 border font-mono text-xs py-2 px-3 rounded-lg transition cursor-pointer ${
            simEnabled
              ? 'bg-amber-500/20 border-amber-400 text-amber-200'
              : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300/80 hover:text-emerald-200'
          }`}
        >
          <span>{simEnabled ? 'SIMULATOR: ON' : 'FIELD SIM: OFF'}</span>
        </button>
      </div>

      {/* Status Line */}
      <div className="text-[11px] font-mono text-emerald-300/75 bg-black/40 px-2.5 py-1.5 rounded border border-emerald-500/15 flex items-center justify-between">
        <span className="truncate">{scanStatusText}</span>
        <span className="text-[10px] text-emerald-400/60 shrink-0 ml-2">
          {capabilities.hasLEScan
            ? 'LE-SCAN READY'
            : capabilities.hasWebBluetooth
            ? 'WEB-BLE PICKER'
            : 'NO WEB-BLE'}
        </span>
      </div>

      {/* Web Bluetooth Compatibility Drawer */}
      {showCompatHelp && (
        <div className="bg-emerald-950/60 border border-emerald-500/40 rounded-lg p-2.5 text-[11px] font-mono text-emerald-200 space-y-1.5">
          <div className="font-bold text-emerald-300">
            Web Bluetooth Field Configuration:
          </div>
          <p className="text-emerald-100/80">
            • <strong>Android / Desktop Chrome:</strong> Enable continuous passive BLE advertisement sweep by pasting into Chrome:
            <code className="block bg-black/60 text-amber-300 p-1 mt-1 rounded select-all">
              chrome://flags/#enable-experimental-web-platform-features
            </code>
          </p>
          <p className="text-emerald-100/80">
            • <strong>iOS / iPhone:</strong> Apple Safari blocks Web Bluetooth. Install the free <strong>Bluefy – Web BLE Browser</strong> from the App Store to open this PWA with Bluetooth enabled.
          </p>
        </div>
      )}

      {/* Contacts List */}
      <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
        {contacts.length === 0 ? (
          <div className="text-center py-4 text-xs font-mono text-emerald-500/50">
            No active BLE signals in range. Start BLE Sweep or enable Field Sim.
          </div>
        ) : (
          contacts.map((contact) => {
            const isClose = contact.distanceMeters <= 12;
            return (
              <div
                key={contact.id}
                className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border font-mono text-xs ${
                  contact.isFriendly
                    ? 'bg-cyan-950/35 border-cyan-500/40 text-cyan-100'
                    : isClose
                    ? 'bg-red-950/40 border-red-500/50 text-red-100'
                    : 'bg-amber-950/25 border-amber-500/35 text-amber-100'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {contact.isFriendly ? (
                    <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
                  ) : (
                    <ShieldAlert
                      className={`w-4 h-4 shrink-0 ${
                        isClose ? 'text-red-400 animate-pulse' : 'text-amber-400'
                      }`}
                    />
                  )}
                  <div className="truncate">
                    <div className="font-bold truncate">
                      {contact.assignedCallsign || contact.name}
                    </div>
                    <div className="text-[10px] opacity-75">
                      {contact.smoothedRssi} dBm • BRG {Math.round(contact.estimatedBearingDeg)}° •{' '}
                      {contact.trend === 'APPROACHING'
                        ? '▲ CLOSING'
                        : contact.trend === 'RECEDING'
                        ? '▼ RECEDING'
                        : '• STABLE'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-sm">
                    {contact.distanceMeters}m
                  </span>

                  {!contact.isFriendly ? (
                    <button
                      onClick={() => onWhitelistContact(contact)}
                      className="bg-cyan-500/20 hover:bg-cyan-500/35 border border-cyan-400/50 text-cyan-200 text-[10px] px-2 py-1 rounded cursor-pointer"
                      title="Mark this BLE device as a Friendly Squad Beacon"
                    >
                      + FRIENDLY
                    </button>
                  ) : (
                    <button
                      onClick={() => onRemoveWhitelist(contact.id)}
                      className="bg-red-500/20 hover:bg-red-500/35 border border-red-400/40 text-red-200 text-[10px] px-2 py-1 rounded cursor-pointer"
                      title="Remove from Friendly Whitelist"
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
