import type { LucideIcon } from "lucide-react";
import {
  BarChart2,
  Bell,
  ClipboardList,
  FileText,
  NotebookPen,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";

export interface AppNavItem {
  id: string;
  href: string;
  title: string;
  label: string;
  icon: LucideIcon;
  isActive: (location: string) => boolean;
}

/** Canonical app navigation — each item routes to a distinct page. */
export const APP_NAV_ITEMS: AppNavItem[] = [
  {
    id: "documents",
    href: "/documents",
    title: "Documents",
    label: "Documents",
    icon: FileText,
    isActive: (location) => location === "/documents" || location.startsWith("/documents/"),
  },
  {
    id: "notes",
    href: "/notes",
    title: "Notes",
    label: "Notes",
    icon: NotebookPen,
    isActive: (location) => location.startsWith("/notes"),
  },
  {
    id: "ai-chat",
    href: "/agents/hybrid",
    title: "AI Chat",
    label: "AI Chat",
    icon: Sparkles,
    isActive: (location) => location.startsWith("/agents/hybrid"),
  },
  {
    id: "analyze",
    href: "/analyze",
    title: "Analyze",
    label: "Analyze",
    icon: BarChart2,
    isActive: (location) => location.startsWith("/analyze"),
  },
  {
    id: "skills",
    href: "/skills",
    title: "Skills",
    label: "Skills",
    icon: ClipboardList,
    isActive: (location) => location.startsWith("/skills"),
  },
  {
    id: "trash",
    href: "/trash",
    title: "Trash",
    label: "Trash",
    icon: Trash2,
    isActive: (location) => location.startsWith("/trash"),
  },
  {
    id: "activity",
    href: "/activity",
    title: "Activity",
    label: "Activity",
    icon: Bell,
    isActive: (location) => location.startsWith("/activity"),
  },
];

export const APP_SETTINGS_NAV: AppNavItem = {
  id: "settings",
  href: "/settings",
  title: "Settings",
  label: "Settings",
  icon: Settings,
  isActive: (location) => location.startsWith("/settings"),
};