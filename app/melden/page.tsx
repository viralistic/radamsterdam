import type { Metadata } from "next";
import { MeldenClient } from "./melden-client";

export const metadata: Metadata = { title: "Melding maken" };

export default function MeldenPage() {
  return <MeldenClient />;
}
