"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/misc";

/** Leaflet werkt alleen in de browser. */
export const MapView = dynamic(() => import("./map-view").then((m) => m.MapView), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});
export type { MapMarker, MapCircle, MapViewHandle } from "./map-view";
