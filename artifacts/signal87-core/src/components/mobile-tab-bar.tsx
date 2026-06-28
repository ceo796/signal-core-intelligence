import { useState } from "react";
import { Link, useLocation } from "wouter";
import { UserButton, useAuth } from "@clerk/react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import {
  APP_MORE_ITEMS,
  APP_SETTINGS_NAV,
  APP_TAB_BAR_ITEMS,
  isMoreSectionActive,
  type AppNavItem,
} from "@/lib/app-nav";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function TabButton({ item, active }: { item: AppNavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      role="tab"
      aria-selected={active}
      title={item.title}
      className={cn("s87-ios-tab-item", active && "s87-ios-tab-item--active")}
    >
      <item.icon className="s87-ios-tab-icon" strokeWidth={active ? 2.2 : 1.75} />
      <span className="s87-ios-tab-label">{item.label}</span>
    </Link>
  );
}

function MoreRow({ item, onNavigate }: { item: AppNavItem; onNavigate: () => void }) {
  const [location] = useLocation();
  const active = item.isActive(location);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn("s87-ios-more-row", active && "s87-ios-more-row--active")}
    >
      <span className="s87-ios-more-row-icon">
        <item.icon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="s87-ios-more-row-label">{item.label}</span>
      <ChevronRight className="h-4 w-4 opacity-35" />
    </Link>
  );
}

/** iOS-style bottom tab bar (mobile only). */
export function MobileTabBar() {
  const [location] = useLocation();
  const { isSignedIn } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreSectionActive(location);

  const closeMore = () => setMoreOpen(false);

  return (
    <>
      <nav className="s87-ios-tab-bar md:hidden" role="tablist" aria-label="Main">
        {APP_TAB_BAR_ITEMS.map((item) => (
          <TabButton key={item.id} item={item} active={item.isActive(location)} />
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={moreActive}
          title="More"
          className={cn("s87-ios-tab-item", moreActive && "s87-ios-tab-item--active")}
          onClick={() => setMoreOpen(true)}
        >
          <MoreHorizontal className="s87-ios-tab-icon" strokeWidth={moreActive ? 2.2 : 1.75} />
          <span className="s87-ios-tab-label">More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="signal-app s87-ios-more-sheet md:hidden border-0 p-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button.absolute]:hidden"
        >
          <SheetTitle className="sr-only">More</SheetTitle>
          <div className="s87-ios-sheet-grabber" aria-hidden />
          <div className="px-4 pb-2 pt-1">
            <p className="text-[13px] font-semibold tracking-wide text-muted-foreground uppercase">
              More
            </p>
          </div>
          <div className="mx-4 overflow-hidden rounded-2xl border border-white/10 bg-card/80">
            {APP_MORE_ITEMS.map((item) => (
              <MoreRow key={item.id} item={item} onNavigate={closeMore} />
            ))}
            <MoreRow item={APP_SETTINGS_NAV} onNavigate={closeMore} />
          </div>
          {isSignedIn && (
            <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-card/60 px-4 py-3">
              <UserButton appearance={{ elements: { userButtonAvatarBox: "w-10 h-10" } }} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Account</p>
                <p className="text-xs text-muted-foreground">Manage profile & sign out</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}