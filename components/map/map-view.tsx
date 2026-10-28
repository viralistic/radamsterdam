"use client";

import * as React from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import { CATEGORY_BY_CODE, type CategoryCode } from "@/lib/categories";
import type { LatLng, ReportStatus } from "@/lib/types";
import { GROUP_COLOR } from "@/components/category";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  category: CategoryCode;
  status?: ReportStatus;
  approximate?: boolean;
}

export interface MapCircle {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  intensity: number;
  label?: string;
}

export interface MapViewHandle {
  flyTo: (p: LatLng, zoom?: number) => void;
  getCenter: () => LatLng | null;
}

interface Props {
  center: LatLng;
  zoom?: number;
  markers?: MapMarker[];
  circles?: MapCircle[];
  selectedId?: string | null;
  cluster?: boolean;
  onMarkerClick?: (id: string) => void;
  onCircleClick?: (id: string) => void;
  onMove?: (center: LatLng, bounds: [number, number, number, number]) => void;
  userLocation?: LatLng | null;
  className?: string;
  interactive?: boolean;
}

function markerHtml(m: MapMarker, selected: boolean) {
  const color = GROUP_COLOR[CATEGORY_BY_CODE[m.category].group];
  const size = selected ? 26 : 18;
  const ring = m.status === "confirmed" ? `box-shadow:0 0 0 3px ${color}40;` : "";
  const faded = m.status === "in_progress" ? "opacity:.75;" : "";
  const halo = m.approximate
    ? `<span style="position:absolute;inset:-10px;border-radius:9999px;border:1.5px dashed ${color};opacity:.55"></span>`
    : "";
  return `<span style="position:relative;display:block;width:${size}px;height:${size}px;">${halo}<span style="display:block;width:100%;height:100%;border-radius:9999px;background:${color};border:2.5px solid #fff;${ring}${faded}box-shadow:0 1px 3px rgba(0,0,0,.35)${ring ? `,0 0 0 4px ${color}33` : ""};"></span></span>`;
}

export const MapView = React.forwardRef<MapViewHandle, Props>(function MapView(
  { center, zoom = 13, markers = [], circles = [], selectedId, cluster = true, onMarkerClick, onCircleClick, onMove, userLocation, className, interactive = true },
  ref,
) {
  const el = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<Leaflet.Map | null>(null);
  const LRef = React.useRef<typeof Leaflet | null>(null);
  const layerRef = React.useRef<Leaflet.LayerGroup | null>(null);
  const circleLayerRef = React.useRef<Leaflet.LayerGroup | null>(null);
  const userRef = React.useRef<Leaflet.CircleMarker | null>(null);
  const [ready, setReady] = React.useState(false);
  const handlers = React.useRef({ onMarkerClick, onCircleClick, onMove });
  handlers.current = { onMarkerClick, onCircleClick, onMove };

  React.useImperativeHandle(ref, () => ({
    flyTo: (p, z) => mapRef.current?.flyTo([p.lat, p.lng], z ?? Math.max(mapRef.current.getZoom(), 15), { duration: 0.6 }),
    getCenter: () => {
      const c = mapRef.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    },
  }));

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      (window as unknown as { L: typeof Leaflet }).L = L;
      await import("leaflet.markercluster");
      if (cancelled || !el.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(el.current, {
        center: [center.lat, center.lng],
        zoom,
        zoomControl: false,
        attributionControl: true,
        dragging: interactive,
        scrollWheelZoom: interactive,
        doubleClickZoom: interactive,
        touchZoom: interactive,
      });
      if (interactive) L.control.zoom({ position: "bottomright" }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);
      circleLayerRef.current = L.layerGroup().addTo(map);
      const emit = () => {
        const c = map.getCenter();
        const b = map.getBounds();
        handlers.current.onMove?.({ lat: c.lat, lng: c.lng }, [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
      };
      map.on("moveend", emit);
      mapRef.current = map;
      setReady(true);
      emit();
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // De kaart wordt één keer gemaakt; center en zoom zijn startwaarden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    layerRef.current?.remove();
    const group = cluster
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          maxClusterRadius: 44,
          spiderfyOnMaxZoom: true,
          iconCreateFunction: (c) => {
            const n = c.getChildCount();
            const s = n < 10 ? 30 : n < 50 ? 36 : 42;
            return L.divIcon({ html: `<div class="sr-cluster" style="width:${s}px;height:${s}px">${n}</div>`, className: "sr-marker", iconSize: [s, s] });
          },
        })
      : L.layerGroup();
    for (const m of markers) {
      const selected = m.id === selectedId;
      const size = selected ? 26 : 18;
      const marker = L.marker([m.lat, m.lng], {
        icon: L.divIcon({ html: markerHtml(m, selected), className: "sr-marker", iconSize: [size, size], iconAnchor: [size / 2, size / 2] }),
        keyboard: true,
        title: CATEGORY_BY_CODE[m.category].name,
        zIndexOffset: selected ? 1000 : 0,
      });
      marker.on("click", () => handlers.current.onMarkerClick?.(m.id));
      group.addLayer(marker);
    }
    group.addTo(map);
    layerRef.current = group;
  }, [ready, markers, selectedId, cluster]);

  React.useEffect(() => {
    const L = LRef.current;
    const layer = circleLayerRef.current;
    if (!ready || !L || !layer) return;
    layer.clearLayers();
    for (const c of circles) {
      const circle = L.circle([c.lat, c.lng], {
        radius: c.radius,
        color: "#171717",
        weight: 1,
        fillColor: "#dc2626",
        fillOpacity: 0.12 + c.intensity * 0.45,
        opacity: 0.25,
      });
      if (c.label) circle.bindTooltip(c.label, { direction: "top" });
      circle.on("click", () => handlers.current.onCircleClick?.(c.id));
      layer.addLayer(circle);
    }
  }, [ready, circles]);

  React.useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    userRef.current?.remove();
    if (userLocation) {
      userRef.current = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 7,
        color: "#fff",
        weight: 3,
        fillColor: "#2563eb",
        fillOpacity: 1,
      }).addTo(map);
    }
  }, [ready, userLocation]);

  return <div ref={el} className={className} role="application" aria-label="Kaart met meldingen" />;
});
