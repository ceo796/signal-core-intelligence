import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { FileText, Activity, GitCompare, ScrollText } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/documents", label: "Documents", icon: FileText },
    { href: "/compare", label: "Compare Docs", icon: GitCompare },
    { href: "/brief", label: "Exec Brief", icon: ScrollText },
    { href: "/admin", label: "Admin Stats", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans">
      <aside className="w-full md:w-64 border-r border-border bg-card flex flex-col h-auto md:h-screen sticky top-0">
        <div className="p-4 border-b border-border flex items-center">
          <img src="/signal87-logo.png" alt="Signal87" className="h-8 w-auto" />
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors font-medium ${
                  isActive 
                    ? "bg-secondary text-foreground" 
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 text-xs font-mono text-muted-foreground border-t border-border">
          SYSTEM_CORE_v1.0.4
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
