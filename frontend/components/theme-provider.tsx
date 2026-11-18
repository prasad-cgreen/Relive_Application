"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light" // light only: the dark theme was removed, and this also overrides a saved "dark" choice
      enableSystem={false}
      disableTransitionOnChange
      storageKey="relive-theme"
    >
      {children}
    </NextThemeProvider>
  );
}
