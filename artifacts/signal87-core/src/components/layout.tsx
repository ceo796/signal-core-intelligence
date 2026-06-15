import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { FileText } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/documents", label: "Documents", icon: FileText },
  ];

  return (
    <div className="h-screen bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden">
      <aside className="shrink-0 w-full md:w-56 border-b md:border-b-0 md:border-r border-border bg-sidebar flex flex-col">
        <div className="p-4 border-b border-border flex items-center">
          <img src="/signal87-logo.png" alt="Signal87" className="h-10 w-auto" />
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
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
