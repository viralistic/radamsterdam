"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BarChart3,
  FileClock,
  Flame,
  Inbox,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { api, cn } from "@/lib/utils";

interface ProInfo {
  user: { name: string; email: string; role: Role; roleName: string };
  org: { name: string; type: string };
  permissions: Permission[];
}

const ProContext = React.createContext<ProInfo | null>(null);

export function usePro() {
  const ctx = React.useContext(ProContext);
  if (!ctx) throw new Error("usePro buiten ProShell");
  return React.useMemo(() => ({ ...ctx, can: (p: Permission) => ctx.permissions.includes(p) }), [ctx]);
}

const NAV: { href: string; label: string; icon: LucideIcon; permission: Permission | Permission[] }[] = [
  { href: "/pro", label: "Overzicht", icon: LayoutDashboard, permission: "analytics.read" },
  { href: "/pro/wachtrij", label: "Wachtrij", icon: Inbox, permission: "reports.read" },
  { href: "/pro/kaart", label: "Live kaart", icon: Map, permission: "reports.read" },
  { href: "/pro/hotspots", label: "Hotspots", icon: Flame, permission: "analytics.read" },
  { href: "/pro/rapportages", label: "Rapportages", icon: BarChart3, permission: "analytics.read" },
  { href: "/pro/gebruikers", label: "Gebruikers en rollen", icon: Users, permission: "users.manage" },
  { href: "/pro/audit", label: "Auditlog", icon: FileClock, permission: "audit.read" },
  { href: "/pro/instellingen", label: "Instellingen", icon: Settings, permission: "settings.manage" },
];

export function ProShell({ children, ...info }: ProInfo & { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const value = React.useMemo(() => info, [info.user.email]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = NAV.filter((n) => (Array.isArray(n.permission) ? n.permission : [n.permission]).some((p) => info.permissions.includes(p)));

  React.useEffect(() => setMenuOpen(false), [path]);

  async function logout() {
    await api("/api/pro/session", { method: "DELETE" });
    router.push("/pro/login");
    router.refresh();
  }

  const active = (href: string) => (href === "/pro" ? path === "/pro" : path.startsWith(href));

  const nav = (
    <nav className="grid gap-0.5">
      {items.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&_svg]:size-4",
            active(it.href) && "bg-accent text-foreground",
          )}
        >
          <it.icon /> {it.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="grid gap-3 border-t p-3">
      <div className="grid gap-0.5 px-1">
        <p className="truncate text-sm font-medium">{info.user.name}</p>
        <p className="truncate text-xs text-muted-foreground">{info.user.roleName}</p>
        <p className="truncate text-xs text-muted-foreground">{info.org.name}</p>
      </div>
      <Button variant="outline" size="sm" onClick={logout}>
        <LogOut /> Uitloggen
      </Button>
    </div>
  );

  return (
    <ProContext.Provider value={value}>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-muted/30 lg:flex">
          <div className="flex h-14 items-center px-4">
            <Logo href="/pro" suffix="Pro" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{nav}</div>
          {footer}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 lg:hidden">
            <Logo href="/pro" suffix="Pro" />
            <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="Menu openen">
              <Menu />
            </Button>
          </header>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[1000] bg-black/40" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-[1001] flex w-72 flex-col border-r bg-background">
            <DialogPrimitive.Title className="flex h-14 items-center px-4">
              <Logo href="/pro" suffix="Pro" />
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">Navigatie</DialogPrimitive.Description>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">{nav}</div>
            {footer}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </Dialog>
    </ProContext.Provider>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b px-4 py-5 sm:flex-row sm:items-end sm:justify-between lg:px-8">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function NoAccess({ text = "Je rol heeft geen toegang tot dit onderdeel." }: { text?: string }) {
  return (
    <div className="px-4 py-10 lg:px-8">
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
