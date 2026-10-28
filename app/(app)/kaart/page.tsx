import { Suspense } from "react";
import type { Metadata } from "next";
import { KaartClient } from "./kaart-client";

export const metadata: Metadata = { title: "Live kaart" };

export default function KaartPage() {
  return (
    <Suspense>
      <KaartClient />
    </Suspense>
  );
}
