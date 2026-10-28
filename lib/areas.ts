import type { LatLng } from "./types";

/** Globale wijkcentra voor de demo-stad. Wordt gebruikt om een melding aan een wijk te koppelen. */
export const AREAS: { name: string; lat: number; lng: number }[] = [
  { name: "Centrum", lat: 52.3731, lng: 4.8926 },
  { name: "Jordaan", lat: 52.3765, lng: 4.8818 },
  { name: "De Pijp", lat: 52.3546, lng: 4.8951 },
  { name: "Oost", lat: 52.3602, lng: 4.9264 },
  { name: "Indische Buurt", lat: 52.3627, lng: 4.9426 },
  { name: "Noord", lat: 52.3925, lng: 4.9163 },
  { name: "West", lat: 52.3718, lng: 4.8592 },
  { name: "Bos en Lommer", lat: 52.3786, lng: 4.8454 },
  { name: "Oud-Zuid", lat: 52.3497, lng: 4.8724 },
  { name: "Rivierenbuurt", lat: 52.3429, lng: 4.9034 },
  { name: "Nieuw-West", lat: 52.3605, lng: 4.8034 },
  { name: "Zuidoost", lat: 52.3122, lng: 4.9715 },
  { name: "Watergraafsmeer", lat: 52.3502, lng: 4.9381 },
  { name: "Oostelijk Havengebied", lat: 52.3747, lng: 4.9395 },
];

export const CITY_CENTER: LatLng = { lat: 52.3676, lng: 4.9041 };
export const CITY_NAME = "Amsterdam";

export function nearestArea(p: LatLng): string {
  let best = AREAS[0];
  let bestD = Infinity;
  for (const a of AREAS) {
    const d = distanceMeters(p, a);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best.name;
}

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rondt een locatie af op een raster van ongeveer 150 meter. */
export function fuzzLocation(p: LatLng): LatLng {
  const stepLat = 0.00135;
  const stepLng = 0.0022;
  return {
    lat: Math.round(p.lat / stepLat) * stepLat,
    lng: Math.round(p.lng / stepLng) * stepLng,
  };
}
