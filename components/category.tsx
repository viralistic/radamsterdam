import {
  Accessibility,
  CircleHelp,
  Construction,
  Eye,
  Flame,
  HeartHandshake,
  LampFloor,
  Megaphone,
  PawPrint,
  Pill,
  ShieldAlert,
  SprayCan,
  Trash2,
  TriangleAlert,
  Volume2,
  type LucideIcon,
} from "lucide-react";
import { CATEGORY_BY_CODE, type CategoryCode, type CategoryGroup } from "@/lib/categories";
import { STATUS_LABEL } from "@/lib/status";
import type { ReportStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const ICONS: Record<string, LucideIcon> = {
  Trash2,
  SprayCan,
  LampFloor,
  Construction,
  Volume2,
  ShieldAlert,
  Megaphone,
  Eye,
  Flame,
  Pill,
  HeartHandshake,
  PawPrint,
  Accessibility,
  TriangleAlert,
  CircleHelp,
};

/** Gevalideerd op kleurenblindheid (CVD) en onderscheid bij normaal zicht. */
export const GROUP_COLOR: Record<CategoryGroup, string> = {
  safety: "#dc2626",
  livability: "#ca8a04",
  social: "#7c3aed",
  traffic: "#0891b2",
};

export const GROUP_BG: Record<CategoryGroup, string> = {
  safety: "bg-red-50 text-red-700",
  livability: "bg-yellow-50 text-yellow-800",
  social: "bg-violet-50 text-violet-700",
  traffic: "bg-cyan-50 text-cyan-800",
};

export function CategoryIcon({ code, className, size = "md" }: { code: CategoryCode; className?: string; size?: "sm" | "md" | "lg" }) {
  const cat = CATEGORY_BY_CODE[code];
  const Icon = ICONS[cat.icon] ?? CircleHelp;
  const box = { sm: "size-7 [&_svg]:size-3.5", md: "size-9 [&_svg]:size-4", lg: "size-11 [&_svg]:size-5" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-lg", GROUP_BG[cat.group], box, className)} aria-hidden>
      <Icon />
    </span>
  );
}

export function StatusBadge({ status, className }: { status: ReportStatus; className?: string }) {
  const variant = {
    new: "info",
    confirmed: "warning",
    in_progress: "default",
    resolved: "success",
    expired: "muted",
    withdrawn: "muted",
    under_review: "danger",
  } as const;
  return (
    <Badge variant={variant[status]} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
