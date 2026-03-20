/**
 * Extract lat/lng from a Google Maps URL.
 * Supports formats like:
 *   https://www.google.com/maps/@51.5074,-0.1278,15z
 *   https://www.google.com/maps/place/.../@51.5074,-0.1278,15z
 *   https://maps.google.com/?q=51.5074,-0.1278
 *   https://goo.gl/maps/... (won't resolve short URLs)
 */
export function extractCoordsFromGoogleMapsUrl(
  url: string
): { lat: number; lng: number } | null {
  // Pattern: /@lat,lng or ?q=lat,lng or ?ll=lat,lng
  const patterns = [
    /@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      if (isValidCoordinate(lat, lng)) {
        return { lat, lng };
      }
    }
  }
  return null;
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

export function parseCoordinateString(
  input: string
): { lat: number; lng: number } | null {
  // Try "lat, lng" format
  const parts = input.split(',').map((s) => s.trim());
  if (parts.length === 2) {
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }
  return null;
}

const KM_TO_MILES = 0.621371;
const MILES_TO_KM = 1.609344;

export function kmToMiles(km: number): number {
  return km * KM_TO_MILES;
}

export function milesToKm(miles: number): number {
  return miles * MILES_TO_KM;
}

export function formatDistance(km: number, unit: 'km' | 'miles'): string {
  const value = unit === 'miles' ? kmToMiles(km) : km;
  return `${value.toFixed(1)} ${unit}`;
}
