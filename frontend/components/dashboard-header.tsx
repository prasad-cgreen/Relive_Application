"use client";

import { Bell, ChevronDown, LogOut, Menu, Search, ShieldCheck, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "./theme-toggle";

interface DashboardHeaderProps {
  userName?: string;
  userEmail?: string;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
  bureau?: string | null;
  score?: number | null;
}

export function DashboardHeader({
  userName = "Member",
  userEmail,
  onOpenMobileMenu,
  onLogout,
  bureau = "Experian",
  score,
}: DashboardHeaderProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [greeting, setGreeting] = useState("Hello");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-[#e6ece8] bg-white/95 px-4 backdrop-blur-md sm:px-8 dark:border-[#14231a] dark:bg-[#070e0a]/95">
      {/* Left: Mobile hamburger + Dynamic Greeting */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="grid size-10 place-items-center rounded-xl border border-black/10 text-[#495b52] hover:bg-[#f1f5f2] lg:hidden dark:border-white/10 dark:text-[#a0b5ab] dark:hover:bg-[#112017]"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-[#0c1a13] sm:text-2xl dark:text-white">
              {greeting}, {userName} <span className="inline-block animate-wiggle">👋</span>
            </h1>
          </div>
          <p className="hidden text-xs text-[#63786d] sm:block dark:text-[#8ba295]">
            Here is your verified <span className="font-semibold text-emerald-600 dark:text-emerald-400">{bureau ?? "Experian"}</span> credit dashboard 🙂
          </p>
        </div>
      </div>

      {/* Right Controls: Bureau badge, Notifications, Theme toggle, Profile dropdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Bureau live badge */}
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3 py-1 text-xs font-semibold text-emerald-700 md:inline-flex dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>{bureau ?? "Experian"} Live</span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setNotifOpen(!notifOpen);
              setDropdownOpen(false);
            }}
            className="relative grid size-10 place-items-center rounded-xl border border-[#dbe3de] bg-white text-[#52655b] transition hover:bg-[#f3f7f4] hover:text-[#0b1712] dark:border-[#182a20] dark:bg-[#0c1912] dark:text-[#91a89c] dark:hover:bg-[#12241a]"
            aria-label="View notifications"
          >
            <Bell className="size-4" />
            <span className="absolute right-2 top-2 size-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#070e0a]" />
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#e0e8e2] bg-white p-4 shadow-xl dark:border-[#1b3124] dark:bg-[#0d1d14]">
              <div className="flex items-center justify-between border-b border-[#eef2ef] pb-3 dark:border-[#192f23]">
                <p className="text-xs font-bold text-[#0c1a13] dark:text-white">Notifications</p>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">1 New</span>
              </div>
              <div className="mt-3 space-y-2">
                <div className="rounded-xl bg-[#f6f9f7] p-3 text-xs dark:bg-[#12261b]">
                  <p className="font-semibold text-[#0c1a13] dark:text-white">Credit Report Synced</p>
                  <p className="mt-0.5 text-[11px] text-[#6a8074] dark:text-[#8ba295]">
                    Your score is current at {score ?? 782} points.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 rounded-xl border border-[#dbe3de] bg-white p-1.5 pr-2.5 transition hover:bg-[#f3f7f4] dark:border-[#182a20] dark:bg-[#0c1912] dark:hover:bg-[#12241a]"
          >
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500 font-bold text-white text-xs">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="hidden text-xs font-semibold text-[#0c1a13] sm:inline dark:text-white">
              {userName.split(" ")[0]}
            </span>
            <ChevronDown className="size-3.5 text-[#6c8276]" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#e0e8e2] bg-white p-2 shadow-xl dark:border-[#1b3124] dark:bg-[#0d1d14]">
              <div className="border-b border-[#eef2ef] px-3 py-2.5 dark:border-[#192f23]">
                <p className="text-xs font-bold text-[#0c1a13] dark:text-white">{userName}</p>
                <p className="truncate text-[10px] text-[#71867a] dark:text-[#8ba295]">{userEmail || "Verified User"}</p>
              </div>
              <div className="mt-1">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <LogOut className="size-3.5" />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

