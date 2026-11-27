import type { Metadata } from "next";

// Staff-only pages: keep them out of search results.
export const metadata: Metadata = { title: "Relive | Agents admin", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
