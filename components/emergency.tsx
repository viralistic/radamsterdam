import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmergencyBar({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900", className)}>
      <Phone className="size-4 shrink-0" />
      <p className="leading-snug">
        Direct gevaar of een medisch noodgeval?{" "}
        <a href="tel:112" className="font-semibold underline underline-offset-2">
          Bel 112
        </a>
        . StraatRadar is geen meldkamer.
      </p>
    </div>
  );
}
