import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Home as HomeIcon,
  FileText,
  Database,
  Layers,
  Bot,
  Workflow,
  Settings,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";
import "../pages/home.css";

interface LayoutProps {
  children: ReactNode;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const NAV_ITEMS: { label: string; icon: React.ElementType; href: string | null }[] = [
  { label: "Home",       icon: HomeIcon,  href: "/dashboard" },
  { label: "Documents",  icon: FileText,  href: "/documents" },
  { label: "Collections",icon: Database,  href: null },
  { label: "Briefs",     icon: Layers,    href: "/brief"     },
  { label: "Agents",     icon: Bot,       href: null         },
  { label: "Workflows",  icon: Workflow,  href: null         },
  { label: "Settings",   icon: Settings,  href: null         },
];

export function Layout({ children }: LayoutProps) {
  const [location, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const initials = user
    ? (
        (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")
      ).toUpperCase() ||
      user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
      "U"
    : "U";
  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.primaryEmailAddress?.emailAddress?.split("@")[0] ?? "Account";
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const handleNavClick = (item: (typeof NAV_ITEMS)[number]) => {
    setMobileOpen(false);
    if (item.href) {
      navigate(item.href);
    } else {
      setComingSoon(item.label);
    }
  };

  const SidebarContent = () => (
    <>
      <div className="s87-brand">
        <img src="/signal87-logo-wordmark.png" alt="Signal87" className="s87-logo-img" />
      </div>

      <nav className="s87-nav">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = item.href
            ? item.href === "/dashboard"
              ? location === item.href
              : location.startsWith(item.href)
            : false;
          return (
            <button
              key={item.label}
              type="button"
              className={`s87-nav-item${isActive ? " active" : ""}`}
              aria-disabled={item.href ? undefined : true}
              title={item.href ? undefined : `${item.label} — coming soon`}
              onClick={() => handleNavClick(item)}
            >
              <Icon size={18} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="s87-account"
        onClick={() => signOut({ redirectUrl: basePath || "/" })}
        title="Sign out"
      >
        <div className="s87-account-avatar">{initials}</div>
        <span className="s87-account-text">
          <span className="s87-account-name">{displayName}</span>
          <span className="s87-account-user">{email}</span>
        </span>
        <ChevronRight size={16} />
      </button>
    </>
  );

  return (
    <div className="s87-layout-shell">
      {/* Mobile header */}
      <header className="s87-mobile-header">
        <div className="s87-brand">
          <img src="/signal87-logo-wordmark.png" alt="Signal87" className="s87-logo-img" />
        </div>
        <button
          type="button"
          className="s87-mobile-menu-btn"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="s87-mobile-overlay" onClick={() => setMobileOpen(false)}>
          <aside
            className="s87-sidebar s87-mobile-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="s87-sidebar">
        <SidebarContent />
      </aside>

      {/* Main content area — children control their own scroll/padding */}
      <div className="s87-layout-main">
        {children}
      </div>

      {/* Coming-soon modal */}
      {comingSoon && (
        <div className="s87-modal-overlay" onClick={() => setComingSoon(null)}>
          <div className="s87-modal" onClick={(e) => e.stopPropagation()}>
            <strong>{comingSoon}</strong>
            <p>This feature is coming soon.</p>
            <button
              type="button"
              className="s87-modal-close"
              onClick={() => setComingSoon(null)}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
