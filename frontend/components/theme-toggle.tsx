"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={`theme-toggle grid size-9 shrink-0 place-items-center rounded-xl border border-[#d2ded6] bg-white text-[#4d6356] transition-colors hover:bg-[#f1f6f3] hover:text-[#216b49] ${className}`}
    >
      {mounted ? (isDark ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />) : <span className="size-4" aria-hidden="true" />}
      <span className="sr-only">{mounted ? (isDark ? "Dark theme active" : "Light theme active") : "Theme"}</span>
    </button>
  );
}
