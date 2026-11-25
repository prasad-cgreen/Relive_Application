import type { Metadata } from "next";
import { ThemeProvider } from "../components/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relive | Understand your credit health",
  description: "A clear, secure way to understand your Experian credit score and report.",
  icons: { icon: "/relive-symbol.svg", shortcut: "/relive-symbol.svg" },
};

// Runs before the landing page paints, hiding it while the page works out where the visitor should be:
//  - a visitor who reached the dashboard before (see lib/session.ts), while it checks the session, so Back from
//    /portal goes straight back to the dashboard without flashing the landing page;
//  - ?login=1 (after logout, session expiry or a login link), until the login dialog is open, so it opens straight away.
// The 4 s fallback un-hides it if that never happens.
const authCheckScript = `try{if(location.pathname==="/"&&(/[?&]login=/.test(location.search)||localStorage.getItem("relive:signed-in")==="1")){var d=document.documentElement;d.setAttribute("data-auth-check","");setTimeout(function(){d.removeAttribute("data-auth-check")},4000)}}catch(e){}`;

// Google tag (Tag Manager container), for Google Analytics. Only loaded when NEXT_PUBLIC_GTM_ID is set at build time:
// the Docker build sets it, local development leaves it blank so test visits are not counted.
// Never push personal data (mobile, PAN, name, score) to dataLayer.
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "";
const googleTagScript = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {GTM_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(GTM_ID)}`} />
            <script dangerouslySetInnerHTML={{ __html: googleTagScript }} />
          </>
        )}
        <script dangerouslySetInnerHTML={{ __html: authCheckScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
