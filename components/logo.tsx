import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/", suffix }: { className?: string; href?: string; suffix?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="relative inline-flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
          <path d="M7.5 7.5a6.4 6.4 0 0 0 0 9M16.5 7.5a6.4 6.4 0 0 1 0 9" />
        </svg>
      </span>
      <span>StraatRadar</span>
      {suffix && <span className="font-normal text-muted-foreground">{suffix}</span>}
    </Link>
  );
}
