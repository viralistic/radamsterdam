"use client";

import * as React from "react";

/** Abonneert op live wijzigingen. Valt terug op polling als SSE niet beschikbaar is. */
export function useLiveVersion(): number {
  const [version, setVersion] = React.useState(0);
  React.useEffect(() => {
    let es: EventSource | null = null;
    let poll: ReturnType<typeof setInterval> | null = null;
    try {
      es = new EventSource("/api/stream");
      es.addEventListener("version", (e) => setVersion(Number((e as MessageEvent).data) || 0));
      es.onerror = () => {
        if (!poll) poll = setInterval(() => setVersion((v) => v + 1), 20_000);
      };
    } catch {
      poll = setInterval(() => setVersion((v) => v + 1), 20_000);
    }
    return () => {
      es?.close();
      if (poll) clearInterval(poll);
    };
  }, []);
  return version;
}

export function useGeolocation() {
  const [position, setPosition] = React.useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const locate = React.useCallback(
    () =>
      new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (!("geolocation" in navigator)) {
          setError("Je browser ondersteunt geen locatie. Zoek een adres of schuif de kaart.");
          return resolve(null);
        }
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
            setPosition(pos);
            setError(null);
            setLoading(false);
            resolve(pos);
          },
          () => {
            setError("We konden je locatie niet ophalen. Zoek een adres of schuif de kaart.");
            setLoading(false);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        );
      }),
    [],
  );
  return { position, error, loading, locate };
}
