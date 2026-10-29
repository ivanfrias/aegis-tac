export interface GeoHeadingState {
  lat: number | null;
  lng: number | null;
  accuracyMeters: number | null;
  headingDeg: number;
  hasCompassLock: boolean;
  hasGpsLock: boolean;
}

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates
 */
export function calculateGpsDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

/**
 * Calculates initial compass bearing (0-360 degrees, 0 = North) from point 1 to point 2
 */
export function calculateGpsBearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Computes destination GPS coordinates given a starting lat/lng, bearing (deg), and distance (meters)
 */
export function projectGpsCoordinate(
  lat: number,
  lng: number,
  bearingDeg: number,
  distanceMeters: number
): { lat: number; lng: number } {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const angDist = distanceMeters / R;
  const brng = toRad(bearingDeg);
  const lat1 = toRad(lat);
  const lon1 = toRad(lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) +
      Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
      Math.cos(angDist) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: toDeg(lat2),
    lng: toDeg(lon2),
  };
}

export async function requestCompassPermissionIfNeeded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const DevOrient = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<'granted' | 'denied'>;
  };
  if (DevOrient && typeof DevOrient.requestPermission === 'function') {
    try {
      const res = await DevOrient.requestPermission();
      return res === 'granted';
    } catch {
      return false;
    }
  }
  return true;
}
