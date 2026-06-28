import { Link, useLocation } from "wouter";
import { UserButton, useAuth } from "@clerk/react";
import {
  dashboardColors,
  DashboardBrandMark,
  DashboardRailButton,
} from "@/components/documents-dashboard-ui";
import { APP_NAV_ITEMS, APP_SETTINGS_NAV } from "@/lib/app-nav";

/** Shared 78px icon rail — same on every logged-in page (desktop md+). */
export function AppIconRail() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();

  return (
    <aside
      className="s87-docs-rail hidden shrink-0 px-3 md:flex md:order-first"
      style={{ borderColor: dashboardColors.border, background: dashboardColors.rail }}
    >
      <Link href="/documents" title="Signal87 home" className="no-underline">
        <DashboardBrandMark />
      </Link>

      {APP_NAV_ITEMS.map((item) => (
        <DashboardRailButton
          key={item.id}
          icon={item.icon}
          href={item.href}
          active={item.isActive(location)}
          title={item.title}
        />
      ))}

      <div className="mt-auto flex flex-col items-center gap-2 pb-2">
        <DashboardRailButton
          icon={APP_SETTINGS_NAV.icon}
          href={APP_SETTINGS_NAV.href}
          active={APP_SETTINGS_NAV.isActive(location)}
          title={APP_SETTINGS_NAV.title}
        />
        {isSignedIn && (
          <div className="flex items-center justify-center pt-1">
            <UserButton appearance={{ elements: { userButtonAvatarBox: "w-8 h-8" } }} />
          </div>
        )}
      </div>
    </aside>
  );
}