import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth, UserButton } from "@clerk/react";
import { FileText, MessageSquare, Activity, FileCheck, GitCompare } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();

  const navItems = [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/ask", label: "Ask", icon: MessageSquare },
    { href: "/brief", label: "Brief", icon: FileCheck },
    { href: "/compare", label: "Compare", icon: GitCompare },
    { href: "/activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="h-screen bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Main content — first in DOM so it fills the top area on mobile and the right panel on desktop */}
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {children}
      </main>

      {/* Navigation shell — bottom bar on mobile, left sidebar on desktop (md:order-first) */}
      <aside className="shrink-0 w-full md:w-56 border-t md:border-t-0 md:border-r border-border bg-sidebar flex flex-row md:flex-col md:order-first">
        {/* Logo + UserButton — shown only on desktop sidebar */}
        <div className="hidden md:flex px-4 py-4 border-b border-border items-center justify-between shrink-0 gap-2">
          <Link href="/documents">
            <img
              src="/signal87-logo-black.svg"
              alt="Signal87"
              className="h-10 w-auto cursor-pointer"
            />
          </Link>
          {isSignedIn && (
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }}
            />
          )}
        </div>

        {/* Nav items — horizontal bottom bar on mobile, vertical list on desktop */}
        <nav className="flex-1 flex flex-row md:flex-col px-1 py-1 md:p-3 gap-0.5 items-stretch">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-1 md:flex-none flex flex-col md:flex-row items-center justify-center md:justify-start gap-0.5 md:gap-2.5 px-1 py-3 md:py-2 md:px-3 rounded-md transition-colors min-w-0 ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
          <div className="md:hidden flex items-center justify-center px-3 shrink-0 border-l border-border/40">
            <UserButton
              appearance={{ elements: { userButtonAvatarBox: "w-7 h-7" } }}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
