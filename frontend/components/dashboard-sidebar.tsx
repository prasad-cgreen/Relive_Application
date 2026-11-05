"use client";

import {
  Activity,
  BarChart3,
  CreditCard,
  FileCheck2,
  FileText,
  HelpCircle,
  History,
  LayoutDashboard,
  Lightbulb,
  Lock,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import Link from "next/link";

export type SidebarTab =
  | "overview"
  | "analysis"
  | "accounts"
  | "payment_history"
  | "enquiries"
  | "recommendations"
  | "reports"
  | "profile";

interface DashboardSidebarProps {
  currentTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  open: boolean;
  onClose: () => void;
  userEmail?: string;
  userName?: string;
  onLogout: () => void;
  badgeCount?: {
    accounts?: number;
    recommendations?: number;
    enquiries?: number;
  };
}

export function DashboardSidebar({
  currentTab,
  onTabChange,
  open,
  onClose,
  userEmail,
  userName = "Member",
  onLogout,
  badgeCount = {},
}: DashboardSidebarProps) {
  const menuItems: {
    id: SidebarTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number | string;
    badgeTone?: "green" | "amber" | "neutral";
  }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "analysis", label: "Credit Analysis", icon: BarChart3 },
    {
      id: "accounts",
      label: "Credit Accounts",
      icon: CreditCard,
      badge: badgeCount.accounts ?? undefined,
      badgeTone: "green",
    },
    { id: "payment_history", label: "Payment History", icon: History },
    {
      id: "enquiries",
      label: "Enquiries",
      icon: Search,
      badge: badgeCount.enquiries ?? 0,
      badgeTone: "neutral",
    },
    {
      id: "recommendations",
      label: "Recommendations",
      icon: Lightbulb,
      badge: badgeCount.recommendations ?? 2,
      badgeTone: "amber",
    },
    { id: "reports", label: "My Reports", icon: FileCheck2 },
    { id: "profile", label: "Profile & Settings", icon: Settings },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#07130c] text-white transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-20 items-center justify-between border-b border-[#14291c] px-6">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-90"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-lime-500 text-[#07130c] shadow-lg shadow-emerald-500/20">
              <span className="text-xl font-black">◈</span>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                Relive
              </span>
              <span className="ml-1.5 rounded-sm bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-emerald-400 uppercase">
                FinTech
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#6e8576] hover:bg-[#14291c] hover:text-white lg:hidden"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 py-6 scrollbar-thin">
          <p className="px-3 text-[10px] font-bold tracking-wider text-[#637d6e] uppercase">
            Main Menu
          </p>
          <nav className="mt-3 space-y-1">
            {menuItems.map((item) => {
              const active = currentTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    onClose();
                  }}
                  className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-xs font-medium transition-all ${
                    active
                      ? "bg-[#142d1e] text-emerald-400 shadow-sm"
                      : "text-[#97aba0] hover:bg-[#0d1f14] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`size-4 transition-colors ${
                        active
                          ? "text-emerald-400"
                          : "text-[#657d70] group-hover:text-emerald-300"
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.badgeTone === "green"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : item.badgeTone === "amber"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-white/10 text-white/70"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Quick Credit Bureau Badge */}
          <div className="mt-8 rounded-2xl border border-[#173022] bg-[#0c1f15] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-emerald-400" />
              <span className="text-xs font-semibold text-white">
                RBI Compliant Bureau
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#7f998b]">
              256-bit encrypted data fetch via Experian & CIBIL partner nodes.
            </p>
          </div>
        </div>

        {/* User Card & Logout Footer */}
        <div className="border-t border-[#14291c] p-4">
          <div className="flex items-center justify-between rounded-xl bg-[#0c1f15] p-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-bold text-emerald-300 text-sm border border-emerald-500/30">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">
                  {userName}
                </p>
                <p className="truncate text-[10px] text-[#718c7d]">
                  {userEmail || "Verified Member"}
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Log out"
              className="rounded-lg p-1.5 text-[#738e7f] transition-colors hover:bg-[#152e20] hover:text-red-400"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

