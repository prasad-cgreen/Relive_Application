"use client";

import {
  BarChart3,
  CreditCard,
  FileCheck2,
  Headset,
  LayoutDashboard,
  LogOut,
  MoreHorizontal,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect } from "react";

export type SidebarTab =
  | "overview"
  | "analysis"
  | "accounts"
  | "reports"
  | "support"
  | "profile";

type MenuItem = {
  id: SidebarTab;
  label: string;
  short: string; // bottom-bar label
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
};

export const TAB_TITLES: Record<SidebarTab, { title: string; description: string }> = {
  overview: { title: "Overview", description: "A snapshot of your credit health" },
  analysis: { title: "Credit Analysis", description: "The factors shaping your score" },
  accounts: { title: "Credit Accounts", description: "Every loan and card on your report" },
  reports: { title: "My Reports", description: "Your official bureau report" },
  support: { title: "Get help", description: "Talk to the Relive team about your accounts" },
  profile: { title: "Profile & Settings", description: "Your verified details and consents" },
};

function menu(badges: DashboardSidebarProps["badgeCount"] = {}): MenuItem[] {
  return [
    { id: "overview", label: "Overview", short: "Home", icon: LayoutDashboard },
    { id: "analysis", label: "Credit Analysis", short: "Analysis", icon: BarChart3 },
    { id: "accounts", label: "Credit Accounts", short: "Accounts", icon: CreditCard, badge: badges.accounts },
    { id: "reports", label: "My Reports", short: "Reports", icon: FileCheck2 },
    { id: "support", label: "Get help", short: "Help", icon: Headset },
    { id: "profile", label: "Profile & Settings", short: "Profile", icon: Settings },
  ];
}

interface DashboardSidebarProps {
  currentTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  open: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  onLogout: () => void;
  badgeCount?: { accounts?: number };
}

export function DashboardSidebar({
  currentTab,
  onTabChange,
  open,
  onClose,
  userEmail,
  userName = "Member",
  onLogout,
  badgeCount,
}: DashboardSidebarProps) {
  // Mobile drawer: Escape closes it and the page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      {open && <div onClick={onClose} aria-hidden="true" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden" />}

      <aside
        aria-label="Dashboard navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col bg-[#07130c] text-white transition-transform duration-300 ease-out lg:sticky lg:top-0 lg:h-screen lg:max-w-none lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/[0.06] px-5 lg:h-[72px]">
          {/* Signed-in home is the dashboard overview, not the landing page */}
          <button type="button" onClick={() => { onTabChange("overview"); onClose(); }} className="flex items-center" aria-label="Relive dashboard home">
            {/* Sidebar is always dark, so the light logo. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/relive-logo-light.svg" alt="Relive" width={98} height={28} className="h-7 w-auto" />
          </button>
          <button type="button" onClick={onClose} aria-label="Close menu" className="rounded-lg p-1.5 text-white/60 hover:bg-white/5 hover:text-white lg:hidden">
            <X className="size-5" />
          </button>
        </div>

        <nav className="no-scrollbar flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-white/40">Menu</p>
          <ul className="space-y-0.5">
            {menu(badgeCount).map((item) => {
              const active = currentTab === item.id;
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => {
                      onTabChange(item.id);
                      onClose();
                    }}
                    className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active ? "bg-white/[0.07] font-medium text-white" : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-emerald-400" />}
                    <Icon className={`size-4 ${active ? "text-emerald-400" : ""}`} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {!!item.badge && (
                      <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/80">{item.badge}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
            <div className="flex items-center gap-2 text-xs font-medium text-white">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              RBI-regulated bureaus
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/50">
              Reports are fetched from Experian, or CRIF High Mark if Experian is unavailable.
            </p>
          </div>
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <div className="flex items-center gap-2.5 rounded-lg p-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-300">
              {userName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{userName}</p>
              <p className="truncate text-[11px] text-white/50">{userEmail || "Verified member"}</p>
            </div>
            <button type="button" onClick={onLogout} aria-label="Log out" title="Log out" className="rounded-lg p-1.5 text-white/50 hover:bg-white/5 hover:text-red-400">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

const BOTTOM_TABS: SidebarTab[] = ["overview", "analysis", "accounts", "support"];

/** Phone/tablet tab bar: the four most-used views, plus "More" for the full drawer. */
export function MobileBottomNav({
  currentTab,
  onTabChange,
  onOpenMenu,
}: {
  currentTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  onOpenMenu: () => void;
}) {
  const items = menu().filter((item) => BOTTOM_TABS.includes(item.id));
  const moreActive = !BOTTOM_TABS.includes(currentTab);
  const cls = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
      active ? "text-emerald-600 dark:text-emerald-400" : "text-[#6b7f74] dark:text-[#8ba295]"
    }`;

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#e6ece8] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden dark:border-[#1d2a22] dark:bg-[#0a120d]/95"
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" aria-current={currentTab === item.id ? "page" : undefined} onClick={() => onTabChange(item.id)} className={cls(currentTab === item.id)}>
            <Icon className="size-5" />
            {item.short}
          </button>
        );
      })}
      <button type="button" onClick={onOpenMenu} className={cls(moreActive)}>
        <MoreHorizontal className="size-5" />
        More
      </button>
    </nav>
  );
}
