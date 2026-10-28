"use client";

import Link from "next/link";
import { AlertTriangle, Flag, Lock } from "lucide-react";
import { CATEGORY_BY_CODE } from "@/lib/categories";
import type { QueueRow } from "@/lib/server/pro";
import { CategoryIcon, StatusBadge } from "@/components/category";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/input";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

const PRIORITY = { high: { label: "Hoog", v: "danger" }, normal: { label: "Normaal", v: "outline" }, low: { label: "Laag", v: "muted" } } as const;

export function QueueTable({
  rows,
  selectable,
  selected,
  onToggle,
  onToggleAll,
  compact,
}: {
  rows: QueueRow[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
  onToggleAll?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs text-muted-foreground">
          <tr>
            {selectable && (
              <th className="w-10 px-3 py-2">
                <Checkbox aria-label="Alles selecteren" checked={rows.length > 0 && rows.every((r) => r.sensitive || selected?.has(r.id))} onChange={onToggleAll} />
              </th>
            )}
            <th className="px-3 py-2 font-medium">Melding</th>
            <th className="px-3 py-2 font-medium">Locatie</th>
            {!compact && <th className="px-3 py-2 font-medium">Gemeld</th>}
            <th className="px-3 py-2 font-medium">Prioriteit</th>
            <th className="px-3 py-2 font-medium">Status</th>
            {!compact && <th className="px-3 py-2 font-medium">Toegewezen aan</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.id} className={cn("hover:bg-muted/40", selected?.has(r.id) && "bg-muted/60")}>
              {selectable && (
                <td className="px-3 py-2.5">
                  {r.sensitive ? (
                    <span title="Gevoelige melding: altijd los beoordelen"><Lock className="size-3.5 text-muted-foreground" /></span>
                  ) : (
                    <Checkbox aria-label={`Selecteer ${r.number}`} checked={selected?.has(r.id)} onChange={() => onToggle?.(r.id)} />
                  )}
                </td>
              )}
              <td className="px-3 py-2.5">
                <Link href={`/pro/dossier/${r.id}`} className="flex items-center gap-2.5">
                  <CategoryIcon code={r.category} size="sm" />
                  <span className="grid min-w-0">
                    <span className="truncate font-medium hover:underline">{CATEGORY_BY_CODE[r.category].short}</span>
                    <span className="font-mono text-xs text-muted-foreground">{r.number}</span>
                  </span>
                </Link>
              </td>
              <td className="max-w-[200px] px-3 py-2.5">
                <span className="block truncate">{r.street ?? r.area}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.area}</span>
              </td>
              {!compact && (
                <td className="px-3 py-2.5 whitespace-nowrap" title={formatDateTime(r.createdAt)}>
                  {timeAgo(r.createdAt)}
                </td>
              )}
              <td className="px-3 py-2.5">
                <Badge variant={PRIORITY[r.priority].v}>{PRIORITY[r.priority].label}</Badge>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={r.status} />
                  {r.flags > 0 && <span title={`${r.flags} misbruikrapportages`}><Flag className="size-3.5 text-red-600" /></span>}
                  {r.overdue && <span title="Reactietermijn verstreken"><AlertTriangle className="size-3.5 text-red-600" /></span>}
                </div>
              </td>
              {!compact && (
                <td className="px-3 py-2.5 whitespace-nowrap">
                  {r.assignee ?? <span className="text-muted-foreground">Niemand</span>}
                  <span className="block text-xs text-muted-foreground">{r.orgName}</span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
