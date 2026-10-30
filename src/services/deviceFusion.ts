import { BleContact, SquadMember, WhitelistedDevice, UnitAffiliation } from '../types/radar';

/**
 * Normalizes a device or player label by removing common device accessory suffixes
 * like "(Watch)", "Watch", "Phone", "iPhone", "Galaxy Watch", etc., so that
 * a player's smartphone and smartwatch pair resolve to the same person.
 */
export function extractBaseCallsign(label: string): string {
  if (!label) return '';
  return label
    .replace(/['’]s?\s*(phone|watch|smartwatch|band|tag|tracker|headset|earbuds)/gi, '')
    .replace(/[-_ ]+(watch|phone|sw|ph|tag|tracker|w5|w6|w7|gw\d*|aw\d*)$/gi, '')
    .replace(/\s*\((watch|phone|wearable|tag)\)/gi, '')
    .trim()
    .toUpperCase();
}

/**
 * Determines the affiliation of a contact:
 * - 'SQUAD': Teammates in the current WebRTC Squad Room or claimed as squad units
 * - 'FRIENDLY': Whitelisted friendly foes / faction allies who do NOT belong to the squad
 * - 'BOGEY': Unidentified or enemy units
 */
export function resolveContactAffiliation(
  contact: BleContact,
  squadMembers: SquadMember[],
  whitelist: WhitelistedDevice[],
  selfPeerId?: string
): { affiliation: UnitAffiliation; assignedCallsign?: string; isSelf: boolean } {
  const normId = contact.id.trim().toLowerCase();
  const contactName = (contact.assignedCallsign || contact.name || '').trim();
  const baseName = extractBaseCallsign(contactName);

  // 1. Check if this device belongs to the local player (self)
  for (const m of squadMembers) {
    if (m.peerId === selfPeerId) {
      if (
        m.bleDeviceIds.some((id) => id.trim().toLowerCase() === normId) ||
        (baseName && extractBaseCallsign(m.callsign) === baseName)
      ) {
        return { affiliation: 'SQUAD', assignedCallsign: m.callsign, isSelf: true };
      }
    }
  }

  // 2. Check if this device is associated with any Squad Member
  for (const m of squadMembers) {
    if (m.peerId !== selfPeerId) {
      if (
        m.bleDeviceIds.some((id) => id.trim().toLowerCase() === normId) ||
        (baseName && extractBaseCallsign(m.callsign) === baseName)
      ) {
        return { affiliation: 'SQUAD', assignedCallsign: m.callsign, isSelf: false };
      }
    }
  }

  // 3. Check Whitelist
  const wlEntry = whitelist.find(
    (w) => w.deviceId.trim().toLowerCase() === normId
  );
  if (wlEntry) {
    const aff = wlEntry.affiliation === 'SQUAD' ? 'SQUAD' : 'FRIENDLY';
    return { affiliation: aff, assignedCallsign: wlEntry.label, isSelf: false };
  }

  // Also check if whitelist contains an entry with matching base callsign
  if (baseName) {
    const wlByLabel = whitelist.find(
      (w) => extractBaseCallsign(w.label) === baseName
    );
    if (wlByLabel) {
      const aff = wlByLabel.affiliation === 'SQUAD' ? 'SQUAD' : 'FRIENDLY';
      return { affiliation: aff, assignedCallsign: wlByLabel.label, isSelf: false };
    }
  }

  // 4. Existing contact flag fallback
  if (contact.isFriendly) {
    return { affiliation: 'FRIENDLY', assignedCallsign: contact.assignedCallsign, isSelf: false };
  }

  return { affiliation: 'BOGEY', isSelf: false };
}

/**
 * Fuses contacts that belong to the same person (e.g. Smartphone + paired Smartwatch)
 * into a single unified radar contact.
 *
 * Rules:
 * - Collapses duplicate devices so the HUD stays clean and uncluttered.
 * - Distance: Minimum distance (closest reading).
 * - RSSI: Strongest signal reading.
 * - Bearing: Bearing of the strongest signal reading.
 * - Colors & Affiliations:
 *   - SQUAD -> GREEN (#10b981)
 *   - FRIENDLY -> BLUE (#3b82f6)
 *   - BOGEY -> RED (<=12m) / ORANGE (>12m)
 */
export function fuseDevices(
  contacts: BleContact[],
  squadMembers: SquadMember[],
  whitelist: WhitelistedDevice[],
  selfPeerId: string
): BleContact[] {
  // First, annotate each contact with affiliation and check if it's self device
  const annotated = contacts.map((c) => {
    const { affiliation, assignedCallsign, isSelf } = resolveContactAffiliation(
      c,
      squadMembers,
      whitelist,
      selfPeerId
    );
    return {
      ...c,
      affiliation,
      assignedCallsign: assignedCallsign || c.assignedCallsign,
      isFriendly: affiliation === 'SQUAD' || affiliation === 'FRIENDLY',
      isSelfDevice: isSelf,
    };
  });

  // Filter out self devices (the user themselves is at center of radar)
  const nonSelfContacts = annotated.filter((c) => !c.isSelfDevice);

  // Group contacts by person identifier (Callsign or base name, or unique device ID if bogey)
  const groups = new Map<string, typeof nonSelfContacts>();

  for (const contact of nonSelfContacts) {
    let groupKey = contact.id;

    if (contact.assignedCallsign) {
      groupKey = `CALLSIGN:${extractBaseCallsign(contact.assignedCallsign)}`;
    } else if (contact.affiliation !== 'BOGEY') {
      const base = extractBaseCallsign(contact.name);
      if (base) {
        groupKey = `BASE:${base}`;
      }
    } else {
      // For bogeys, check if name has a clear device pairing root
      // e.g. "Pixel 8" and "Pixel Watch" or "Galaxy S23" and "Galaxy Watch"
      const base = extractBaseCallsign(contact.name);
      if (base && !base.startsWith('BLE') && !base.startsWith('SIG') && base.length >= 4) {
        groupKey = `BOGEY_BASE:${base}`;
      }
    }

    const existingGroup = groups.get(groupKey);
    if (existingGroup) {
      existingGroup.push(contact);
    } else {
      groups.set(groupKey, [contact]);
    }
  }

  // Merge each group into a single contact
  const fusedList: BleContact[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      fusedList.push({
        ...group[0],
        fusedDeviceCount: 1,
        pairedDeviceIds: [group[0].id],
      });
      continue;
    }

    // Sort by signal strength descending so strongest reading leads
    group.sort((a, b) => b.smoothedRssi - a.smoothedRssi);
    const primary = group[0];

    const minDistance = Math.min(...group.map((g) => g.distanceMeters));
    const maxSmoothedRssi = Math.max(...group.map((g) => g.smoothedRssi));
    const maxRawRssi = Math.max(...group.map((g) => g.rawRssi));
    const maxPeakRssi = Math.max(...group.map((g) => g.peakRssi));
    const minArcSpread = Math.min(...group.map((g) => g.arcSpreadDeg));
    const latestSeen = Math.max(...group.map((g) => g.lastSeen));

    const hasApproaching = group.some((g) => g.trend === 'APPROACHING');
    const hasStable = group.some((g) => g.trend === 'STABLE');
    const combinedTrend = hasApproaching ? 'APPROACHING' : hasStable ? 'STABLE' : 'RECEDING';

    const hasSquad = group.some((g) => g.affiliation === 'SQUAD');
    const hasFriendly = group.some((g) => g.affiliation === 'FRIENDLY');
    const affiliation: UnitAffiliation = hasSquad ? 'SQUAD' : hasFriendly ? 'FRIENDLY' : 'BOGEY';

    const assignedCallsign =
      group.find((g) => g.assignedCallsign)?.assignedCallsign ||
      primary.assignedCallsign ||
      extractBaseCallsign(primary.name);

    fusedList.push({
      ...primary,
      distanceMeters: minDistance,
      smoothedRssi: maxSmoothedRssi,
      rawRssi: maxRawRssi,
      peakRssi: maxPeakRssi,
      arcSpreadDeg: minArcSpread,
      trend: combinedTrend,
      lastSeen: latestSeen,
      affiliation,
      isFriendly: affiliation === 'SQUAD' || affiliation === 'FRIENDLY',
      assignedCallsign,
      name: assignedCallsign || primary.name,
      fusedDeviceCount: group.length,
      pairedDeviceIds: group.map((g) => g.id),
    });
  }

  // Sort fused list by distance ascending (closest first)
  fusedList.sort((a, b) => a.distanceMeters - b.distanceMeters);

  return fusedList;
}
