export type PlayerStatus = 'ACTIVE' | 'HIT' | 'MEDIC';

export type EnvironmentPreset = 'CQB' | 'COMPOUND' | 'WOODLAND';

export type SignalTrend = 'APPROACHING' | 'RECEDING' | 'STABLE';

export type PingType = 'ENEMY' | 'OBJECTIVE' | 'DANGER';

export type UnitAffiliation = 'SQUAD' | 'FRIENDLY' | 'BOGEY';

export interface BleContact {
  id: string;
  name: string;
  rawRssi: number;
  smoothedRssi: number;
  txPower: number;
  distanceMeters: number;
  trend: SignalTrend;
  /** Compass bearing (0-360) where highest signal strength was observed */
  estimatedBearingDeg: number;
  /** Angular width of the proximity arc in degrees (e.g. 90° wide down to 35° narrow) */
  arcSpreadDeg: number;
  peakRssi: number;
  lastSeen: number;
  isFriendly: boolean;
  affiliation?: UnitAffiliation;
  fusedDeviceCount?: number;
  pairedDeviceIds?: string[];
  isSelfDevice?: boolean;
  assignedCallsign?: string;
  simulated?: boolean;
}

export interface SquadMember {
  peerId: string;
  callsign: string;
  status: PlayerStatus;
  lat: number | null;
  lng: number | null;
  heading: number;
  bleDeviceIds: string[];
  lastUpdated: number;
}

export interface TacticalPing {
  id: string;
  type: PingType;
  label?: string;
  senderCallsign: string;
  /** Optional absolute GPS position if sender had GPS lock */
  lat?: number | null;
  lng?: number | null;
  /** Relative polar coordinates from sender or tapped radar point */
  bearingDeg: number;
  distanceMeters: number;
  createdAt: number;
  expiresAt: number;
}

export interface WhitelistedDevice {
  deviceId: string;
  label: string;
  addedBy: string;
  affiliation?: 'SQUAD' | 'FRIENDLY';
}

export type P2PMessage =
  | {
      type: 'MEMBER_UPDATE';
      member: SquadMember;
    }
  | {
      type: 'MEMBER_LEAVE';
      peerId: string;
    }
  | {
      type: 'ROSTER_SYNC';
      members: SquadMember[];
      whitelist: WhitelistedDevice[];
      pings: TacticalPing[];
    }
  | {
      type: 'TACTICAL_PING';
      ping: TacticalPing;
    }
  | {
      type: 'PING_REMOVE';
      pingId: string;
    }
  | {
      type: 'PINGS_CLEAR';
    }
  | {
      type: 'WHITELIST_ADD';
      entry: WhitelistedDevice;
    }
  | {
      type: 'WHITELIST_REMOVE';
      deviceId: string;
    };

export const ENVIRONMENT_CONFIG: Record<
  EnvironmentPreset,
  {
    label: string;
    pathLossExponent: number;
    defaultRangeMeters: number;
    description: string;
  }
> = {
  CQB: {
    label: 'CQB Indoors',
    pathLossExponent: 3.1,
    defaultRangeMeters: 20,
    description: 'Walls & corridors (high attenuation, 20m radar scale)',
  },
  COMPOUND: {
    label: 'Urban Compound',
    pathLossExponent: 2.6,
    defaultRangeMeters: 40,
    description: 'Mixed buildings & courtyards (40m radar scale)',
  },
  WOODLAND: {
    label: 'Woodland / Field',
    pathLossExponent: 2.2,
    defaultRangeMeters: 75,
    description: 'Open foliage & outdoor terrain (75m radar scale)',
  },
};
