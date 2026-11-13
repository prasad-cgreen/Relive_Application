import type { Metadata } from "next";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relive | Understand your credit health",
  description: "A clear, secure way to understand your Experian credit score and report.",
  icons: { icon: "/relive-symbol.svg", shortcut: "/relive-symbol.svg" },
};

// Runs before the landing page paints: a visitor who reached the dashboard before (see lib/session.ts) gets
// the landing page hidden while it checks the session, so Back from /portal goes straight back to the
// dashboard without flashing the landing page. The 4 s fallback un-hides it if the check never finishes.
const authCheckScript = `try{if(location.pathname==="/"&&localStorage.getItem("relive:signed-in")==="1"){var d=document.documentElement;d.setAttribute("data-auth-check","");setTimeout(function(){d.removeAttribute("data-auth-check")},4000)}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: authCheckScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
