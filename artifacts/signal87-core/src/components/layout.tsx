import { ReactNode } from "react";
import { AppIconRail } from "@/components/app-icon-rail";
import { MobileTabBar } from "@/components/mobile-tab-bar";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="signal-app s87-mobile-shell h-[100dvh] bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      <AppIconRail />

      <main className="s87-mobile-main relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>

      <MobileTabBar />
    </div>
  );
}