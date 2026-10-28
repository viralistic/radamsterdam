import { AppBottomNav, AppTopBar } from "@/components/citizen/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <AppTopBar />
      <div className="relative min-h-0 flex-1 overflow-y-auto">{children}</div>
      <AppBottomNav />
    </div>
  );
}
