"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Horizontale staven, één reeks. De titel benoemt de reeks, dus geen legenda nodig. */
export function BarList({ items, valueLabel = "meldingen" }: { items: { label: string; value: number }[]; valueLabel?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid gap-2.5">
      {items.map((it) => (
        <li key={it.label} className="group grid gap-1 text-sm" title={`${it.label}: ${it.value} ${valueLabel}`}>
          <div className="flex justify-between gap-2">
            <span className="truncate">{it.label}</span>
            <span className="font-medium tabular-nums">{it.value}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div className="h-full rounded-full bg-foreground/80 transition-colors group-hover:bg-foreground" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Kolommen per dag met tooltip bij hover. */
export function Columns({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) {
  const [hover, setHover] = React.useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="grid gap-2">
      <div className="relative flex items-end gap-[2px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {data.map((d, i) => (
          <div key={d.label} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className={cn("w-full rounded-t-[4px] bg-foreground/70 transition-colors", hover === i && "bg-foreground")}
              style={{ height: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
            {hover === i && (
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-xs whitespace-nowrap shadow">
                <span className="text-muted-foreground">{d.label}</span> <span className="font-medium tabular-nums">{d.value}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </div>
  );
}

const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];

/** Weekdag × uur, sequentieel in één tint. Kleine aantallen worden onderdrukt (null). */
export function HeatMatrix({ matrix }: { matrix: (number | null)[][] }) {
  const [hover, setHover] = React.useState<{ d: number; h: number } | null>(null);
  const max = Math.max(1, ...matrix.flat().map((v) => v ?? 0));
  const order = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] gap-[2px]" style={{ gridTemplateColumns: "28px repeat(24, minmax(0, 1fr))" }} onMouseLeave={() => setHover(null)}>
          <span />
          {Array.from({ length: 24 }).map((_, h) => (
            <span key={h} className="text-center text-[10px] text-muted-foreground">{h % 3 === 0 ? h : ""}</span>
          ))}
          {order.map((d) => (
            <React.Fragment key={d}>
              <span className="text-xs leading-5 text-muted-foreground">{DAYS[d]}</span>
              {matrix[d].map((v, h) => (
                <div
                  key={h}
                  onMouseEnter={() => setHover({ d, h })}
                  className={cn("h-5 rounded-[3px]", v === null && "bg-[repeating-linear-gradient(45deg,var(--muted),var(--muted)_2px,transparent_2px,transparent_4px)]", hover?.d === d && hover?.h === h && "ring-2 ring-foreground")}
                  style={v === null ? undefined : { background: v === 0 ? "var(--muted)" : `oklch(${0.93 - (v / max) * 0.6} ${0.03 + (v / max) * 0.15} 25)` }}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <p className="h-4 text-xs text-muted-foreground">
        {hover
          ? `${DAYS[hover.d]} ${hover.h}:00 tot ${hover.h + 1}:00 · ${matrix[hover.d][hover.h] === null ? "minder dan 3, verborgen" : `${matrix[hover.d][hover.h]} meldingen`}`
          : "Beweeg over een vak voor het aantal. Gestreepte vakken bevatten minder dan 3 meldingen."}
      </p>
    </div>
  );
}

export function Kpi({ label, value, definition, tone }: { label: string; value: React.ReactNode; definition: string; tone?: "warn" }) {
  return (
    <div className="grid gap-1 rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("text-2xl font-semibold tracking-tight tabular-nums", tone === "warn" && "text-red-700")}>{value}</p>
      <p className="text-xs text-muted-foreground">{definition}</p>
    </div>
  );
}
