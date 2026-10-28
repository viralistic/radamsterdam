/** Adres zoeken en omzetten via de PDOK Locatieserver (open data, Nederland). */
const BASE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1";

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
}

function parsePoint(wkt: string): { lat: number; lng: number } | null {
  const m = /POINT\(([-\d.]+) ([-\d.]+)\)/.exec(wkt);
  return m ? { lng: Number(m[1]), lat: Number(m[2]) } : null;
}

export async function searchAddress(q: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const url = `${BASE}/free?q=${encodeURIComponent(q)}&rows=6&fq=type:(adres OR weg OR woonplaats OR postcode)&fl=weergavenaam,centroide_ll`;
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.response?.docs ?? [])
    .map((d: { weergavenaam: string; centroide_ll: string }) => {
      const p = parsePoint(d.centroide_ll);
      return p ? { label: d.weergavenaam, ...p } : null;
    })
    .filter(Boolean) as GeoResult[];
}

export async function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/reverse?lat=${lat}&lon=${lng}&rows=1&type=adres&fl=weergavenaam,straatnaam,huisnummer`, { signal });
    if (!res.ok) return null;
    const d = (await res.json()).response?.docs?.[0];
    if (!d) return null;
    return d.straatnaam ? `${d.straatnaam}${d.huisnummer ? ` ${d.huisnummer}` : ""}` : d.weergavenaam;
  } catch {
    return null;
  }
}
