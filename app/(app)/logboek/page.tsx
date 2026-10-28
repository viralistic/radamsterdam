import type { Metadata } from "next";
import { LogboekClient } from "./logboek-client";

export const metadata: Metadata = { title: "Logboek" };

export default function LogboekPage() {
  return <LogboekClient />;
}
