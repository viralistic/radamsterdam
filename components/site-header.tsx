import Link from "next/link";
import { Plus } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link href="/kaart" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Live kaart
          </Link>
          <Link href="/logboek" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Logboek
          </Link>
          <Link href="/voor-gemeenten" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Voor gemeenten
          </Link>
        </nav>
        <Link href="/melden" className={cn(buttonVariants({ size: "sm" }))}>
          <Plus /> Melding maken
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm md:grid-cols-[1fr_auto]">
        <div className="grid gap-2">
          <Logo />
          <p className="max-w-sm text-muted-foreground">
            Buren waarschuwen elkaar. De gemeente pakt het op. We registreren situaties en plekken, nooit personen.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground">
          <Link href="/kaart" className="hover:text-foreground">Live kaart</Link>
          <Link href="/logboek" className="hover:text-foreground">Logboek</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy en spelregels</Link>
          <Link href="/voor-gemeenten" className="hover:text-foreground">Voor gemeenten</Link>
          <Link href="/pro/login" className="hover:text-foreground">Inloggen professionals</Link>
        </div>
      </div>
    </footer>
  );
}
