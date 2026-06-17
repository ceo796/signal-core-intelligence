import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { FileText, MessageSquare, Activity, LogOut, Menu, X, BookOpen, GitCompare } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";

interface LayoutProps {
  children: ReactNode;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/ask", label: "Ask", icon: MessageSquare },
    { href: "/compare", label: "Compare", icon: GitCompare },
    { href: "/brief", label: "Brief", icon: BookOpen },
    { href: "/activity", label: "Activity", icon: Activity },
  ];

  const navLinks = (
    <>
      {navItems.map((item) => {
        const isActive = location.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all whitespace-nowrap ${
              isActive
                ? "bg-primary/10 text-primary font-medium shadow-sm shadow-primary/5"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="h-screen bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex shrink-0 w-56 border-r border-border bg-sidebar flex-col">
        <div className="px-4 py-4 border-b border-border flex items-center shrink-0">
          <Link href="/">
            <img src="/signal87-logo-wordmark.png" alt="Signal87" className="h-9 w-auto" />
          </Link>
        </div>
        <nav className="flex-1 flex flex-col px-3 py-3 gap-1 items-stretch">
          {navLinks}
        </nav>
        {user && (
          <div className="flex flex-col px-3 py-3 border-t border-border gap-2 mt-auto">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                {user.firstName?.[0] ?? user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate leading-tight">
                  {user.firstName} {user.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {user.primaryEmailAddress?.emailAddress}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <LogOut className="w-3 h-3" />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <div className="md:hidden shrink-0 flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar">
        <Link href="/">
          <img src="/signal87-logo-wordmark.png" alt="Signal87" className="h-7 w-auto" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-md hover:bg-muted transition-colors"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col pt-14">
          <nav className="flex flex-col px-4 py-4 gap-1">
            {navLinks}
          </nav>
          {user && (
            <div className="mt-auto px-4 py-4 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                  {user.firstName?.[0] ?? "U"}
                </div>
                <div>
                  <p className="text-xs font-medium">{user.firstName} {user.lastName}</p>
                  <p className="text-[10px] text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => signOut({ redirectUrl: basePath || "/" })}
                className="p-2 rounded-md hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
      )}

      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {children}
      </main>
    </div>
  );
}
