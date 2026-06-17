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
      <aside className="shrink-0 w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-sidebar flex flex-row md:flex-col">
        <div className="px-4 py-3 md:p-4 md:border-b border-border flex items-center justify-between shrink-0 gap-2">
          <Link href="/documents">
            <img src="/signal87-logo-black.svg" alt="Signal87" className="h-8 md:h-10 w-auto cursor-pointer" />
          </Link>
          {isSignedIn && (
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-7 h-7",
                },
              }}
            />
          )}
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
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden min-h-0">
        {children}
      </main>
    </div>
  );
}
