"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Map, Plus, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/kaart", label: "Kaart", icon: Map },
  { href: "/logboek", label: "Logboek", icon: BookOpen },
  { href: "/mijn-meldingen", label: "Mijn meldingen", icon: FileText },
  { href: "/profiel", label: "Profiel", icon: UserRound },
];

export function AppTopBar() {
  const path = usePathname();
  return (
    <header className="z-40 hidden h-14 shrink-0 items-center justify-between border-b bg-background px-4 md:flex">
      <div className="flex items-center gap-6">
        <Logo />
        <nav className="flex items-center gap-1">
          {ITEMS.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), path.startsWith(it.href) && "bg-accent")}
            >
              <it.icon /> {it.label}
            </Link>
          ))}
        </nav>
      </div>
      <Link href="/melden" className={buttonVariants({ size: "sm" })}>
        <Plus /> Melding maken
      </Link>
    </header>
  );
}

export function AppBottomNav() {
  const path = usePathname();
  const left = ITEMS.slice(0, 2);
  const right = ITEMS.slice(2);
  const item = (it: (typeof ITEMS)[number]) => (
    <Link
      key={it.href}
      href={it.href}
      className={cn(
        "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
        path.startsWith(it.href) && "text-foreground",
      )}
    >
      <it.icon className="size-5" />
      {it.label === "Mijn meldingen" ? "Meldingen" : it.label}
    </Link>
  );
  return (
    <nav className="z-40 flex shrink-0 items-stretch border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Hoofdmenu">
      {left.map(item)}
      <div className="flex flex-1 items-center justify-center">
        <Link
          href="/melden"
          aria-label="Melding maken"
          className="-mt-5 inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
        >
          <Plus className="size-6" />
        </Link>
      </div>
      {right.map(item)}
    </nav>
  );
}
