/**
 * Výběr škol v okolí Prahy podle souřadnic (cache nemá pole „kraj“).
 * Centrum: přibližný střed Prahy (WGS84). Vzdálenost haversine po zemském povrchu.
 */

/** Referenční bod — centrum Prahy (Staroměstské náměstí okolí). */
export const PRAHA_CENTER_LAT = 50.0755;
export const PRAHA_CENTER_LNG = 14.4378;

/** Výchozí poloměr objíždění (km). */
export const SCHOOL_TOUR_RADIUS_KM = 75;

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r1 = (lat1 * Math.PI) / 180;
  const r2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(r1) * Math.cos(r2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function distanceFromPragueKm(lat: number, lng: number): number {
  return haversineKm(lat, lng, PRAHA_CENTER_LAT, PRAHA_CENTER_LNG);
}

export function isSchoolWithinKmOfPrague(
  lat: number,
  lng: number,
  radiusKm: number = SCHOOL_TOUR_RADIUS_KM,
): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return distanceFromPragueKm(lat, lng) <= radiusKm;
}
