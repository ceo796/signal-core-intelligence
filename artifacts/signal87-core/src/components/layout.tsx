import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { FileText, MessageSquare, Activity, LogOut } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";

interface LayoutProps {
  children: ReactNode;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const navItems = [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/ask", label: "Ask", icon: MessageSquare },
    { href: "/activity", label: "Activity", icon: Activity },
  ];

  return (
    <div className="h-screen bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      <aside className="shrink-0 w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-sidebar flex flex-row md:flex-col">
        <div className="px-4 py-3 md:p-4 md:border-b border-border flex items-center shrink-0">
          <img src="/signal87-logo-black.svg" alt="Signal87" className="h-8 md:h-10 w-auto" />
        </div>
        <nav className="flex-1 flex flex-row md:flex-col px-2 py-2 md:p-3 gap-0.5 items-center md:items-stretch overflow-x-auto">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {user && (
          <div className="hidden md:flex flex-col px-3 py-3 border-t border-border gap-1.5 mt-auto">
            <p className="text-xs text-muted-foreground truncate leading-tight">
              {user.primaryEmailAddress?.emailAddress}
            </p>
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
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {children}
      </main>
    </div>
  );
}
