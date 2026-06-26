import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, UserButton, useUser } from "@clerk/react";
import { FileText, Sparkles, BarChart2, Trash2, Settings, ClipboardList } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  const navItems = [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/agents/hybrid", label: "AI Chat", icon: Sparkles },
    { href: "/analyze", label: "Analyze", icon: BarChart2 },
    { href: "/skills", label: "Skills", icon: ClipboardList },
    { href: "/trash", label: "Trash", icon: Trash2 },
  ];

  const userName =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? "Account";
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? "Signed in";

  return (
    <div className="signal-app h-[100dvh] bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Very subtle indigo ambiance — restrained, matches the #4F3FF0 accent */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 30% at 50% -6%, rgba(79,63,240,0.04), transparent 62%)",
        }}
      />
      {/* Main content — first in DOM so it fills the top area on mobile and the right panel on desktop */}
      <main className="relative z-10 flex-1 flex flex-col overflow-hidden min-h-0">
        {children}
      </main>

      {/* Navigation shell — bottom bar on mobile, left sidebar on desktop (md:order-first) */}
      <aside
        className="shrink-0 w-full md:w-60 border-t md:border-t-0 md:border-r border-border bg-sidebar flex flex-row md:flex-col md:order-first"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Logo — shown only on desktop sidebar */}
        <div className="hidden md:flex px-4 py-4 border-b border-border items-center shrink-0">
          <Link href="/documents">
            <img
              src="/signal87-logo-black.svg"
              alt="Signal87"
              className="h-8 w-auto cursor-pointer"
            />
          </Link>
        </div>

        {/* Nav items — horizontal bottom bar on mobile, vertical list on desktop */}
        <nav className="flex-1 flex flex-row md:flex-col px-1 py-1 md:p-3 gap-0.5 items-stretch">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center md:justify-start gap-0.5 md:gap-2.5 px-1 py-3 md:py-2 md:px-3 rounded-lg transition-all duration-150 min-w-0 select-none active:scale-[0.94] ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 md:w-4 md:h-4 shrink-0" />
                <span className="text-[10px] md:text-sm leading-tight truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* UserButton — mobile bottom bar only, separated at the right edge */}
        {isSignedIn && (
          <div className="md:hidden flex items-center justify-center px-3 shrink-0 border-l border-border/60">
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }}
            />
          </div>
        )}

        {/* Desktop footer — Settings link + real user identity, pinned at the bottom */}
        <div className="hidden md:flex md:flex-col gap-1 px-3 pb-3 pt-2 border-t border-border mt-auto shrink-0">
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all duration-150 w-full select-none active:scale-[0.94] ${
              location.startsWith("/settings")
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
            }`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            Settings
          </Link>
          {isSignedIn && (
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
              <UserButton
                appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }}
              />
              <div className="min-w-0 leading-tight">
                <div className="text-xs font-medium text-foreground truncate" title={userName}>
                  {userName}
                </div>
                <div className="text-[11px] text-muted-foreground truncate" title={userEmail}>
                  {userEmail}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
