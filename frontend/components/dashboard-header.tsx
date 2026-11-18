"use client";

import { ChevronDown, Headset, LogOut, Menu, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface DashboardHeaderProps {
  title: string;
  description: string;
  userName?: string;
  userEmail?: string;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
  onOpenProfile?: () => void;
  /** Opens the Get help tab; the button is hidden without it. */
  onGetHelp?: () => void;
  bureau?: string | null;
}

export function DashboardHeader({
  title,
  description,
  userName = "Member",
  userEmail,
  onOpenMobileMenu,
  onLogout,
  onOpenProfile,
  onGetHelp,
  bureau,
}: DashboardHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDropdownOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#e6ece8] bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:h-[72px] lg:px-8 dark:border-[#14231a] dark:bg-[#070e0a]/90">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="grid size-9 shrink-0 place-items-center rounded-lg border border-[#e1e9e4] text-[#495b52] hover:bg-[#f1f5f2] lg:hidden dark:border-white/10 dark:text-[#a0b5ab] dark:hover:bg-[#112017]"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4.5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-[#0c1a13] sm:text-lg dark:text-white">{title}</h1>
          <p className="hidden truncate text-xs text-[#63786d] sm:block dark:text-[#8ba295]">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onGetHelp && (
          <button
            type="button"
            onClick={onGetHelp}
            aria-label="Get help"
            className="hidden h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 text-xs font-semibold text-white transition hover:bg-emerald-700 md:inline-flex dark:bg-emerald-500 dark:text-[#04130b] dark:hover:bg-emerald-400"
          >
            <Headset className="size-4" aria-hidden="true" />
            Get help
          </button>
        )}

        {bureau && (
          <span className="hidden items-center gap-1.5 rounded-full border border-[#e1e9e4] px-3 py-1 text-xs font-medium text-[#3d5246] md:inline-flex dark:border-[#1d3427] dark:text-[#b0c8bb]">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {bureau}
          </span>
        )}


        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={dropdownOpen}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 rounded-lg border border-[#e1e9e4] bg-white p-1 pr-2 transition hover:bg-[#f3f7f4] dark:border-[#182a20] dark:bg-[#0c1912] dark:hover:bg-[#12241a]"
          >
            <span className="grid size-7 place-items-center rounded-md bg-emerald-600 text-xs font-semibold text-white">
              {userName.charAt(0).toUpperCase()}
            </span>
            <span className="hidden max-w-28 truncate text-sm font-medium text-[#0c1a13] sm:inline dark:text-white">{userName.split(" ")[0]}</span>
            <ChevronDown className="size-3.5 text-[#6c8276]" />
          </button>

          {dropdownOpen && (
            <div role="menu" className="absolute right-0 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-[#e0e8e2] bg-white p-1.5 shadow-lg dark:border-[#1b3124] dark:bg-[#0d1d14]">
              <div className="border-b border-[#eef2ef] px-3 py-2.5 dark:border-[#192f23]">
                <p className="truncate text-sm font-semibold text-[#0c1a13] dark:text-white">{userName}</p>
                <p className="truncate text-xs text-[#71867a] dark:text-[#8ba295]">{userEmail || "Verified member"}</p>
              </div>
              {onOpenProfile && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setDropdownOpen(false);
                    onOpenProfile();
                  }}
                  className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#183b2f] transition hover:bg-[#f1f6f3] dark:text-[#d6e6dc] dark:hover:bg-[#12241a]"
                >
                  <UserRound className="size-4" />
                  My profile
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={onLogout}
                className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                <LogOut className="size-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
