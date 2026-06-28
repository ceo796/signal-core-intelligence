import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, UserButton } from "@clerk/react";
import { AppIconRail } from "@/components/app-icon-rail";
import { APP_NAV_ITEMS, APP_SETTINGS_NAV } from "@/lib/app-nav";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();

  return (
    <div className="signal-app h-[100dvh] bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      <AppIconRail />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </main>

      {/* Mobile bottom navigation — mirrors desktop icon rail */}
      <aside
        className="shrink-0 w-full border-t border-sidebar-border bg-sidebar text-sidebar-foreground flex flex-row md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <nav className="flex flex-1 flex-row items-stretch gap-0.5 px-1 py-1">
          {APP_NAV_ITEMS.map((item) => {
            const isActive = item.isActive(location);
            return (
              <Link
                key={item.id}
                href={item.href}
                title={item.title}
                className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-2 transition-all duration-150 select-none active:scale-[0.98] ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate text-[9px] leading-tight">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center border-l border-border/60">
          <Link
            href={APP_SETTINGS_NAV.href}
            title={APP_SETTINGS_NAV.title}
            className={`flex h-full flex-col items-center justify-center gap-0.5 px-2.5 py-2 ${
              APP_SETTINGS_NAV.isActive(location)
                ? "text-sidebar-primary"
                : "text-sidebar-foreground/65"
            }`}
          >
            <APP_SETTINGS_NAV.icon className="h-5 w-5" />
            <span className="text-[9px]">Settings</span>
          </Link>
          {isSignedIn && (
            <div className="flex items-center justify-center px-2">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}