import type { Metadata, Viewport } from "next";
import { Bebas_Neue, JetBrains_Mono } from "next/font/google";
import "./globals.css";

/**
 * app/layout.tsx
 * ------------------------------------------------------------------
 * next/font replaces the runtime `@import url('fonts.googleapis.com…')`
 * inside <style> tags that both the arena and login pages loaded
 * separately (audit B4: render-blocking, FOUT, no preload, and loaded
 * TWICE). next/font self-hosts the font files at build time, injects
 * preload link tags automatically, and eliminates the extra network
 * round-trip entirely.
 *
 * Navigation is intentionally NOT rendered here — audit C1 flagged a
 * global `pb-16` applied to every route (double padding on /rankings,
 * wasted space on /login, wrong during an immersive match). Moving
 * Navigation into app/(game)/layout.tsx means /login and any future
 * non-game route simply don't have it, with no runtime "hide on this
 * route" branching needed.
 * ------------------------------------------------------------------
 */

const displayFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display-raw",
  display: "swap",
});

const monoGameFont = JetBrains_Mono({
  weight: ["500", "700"],
  subsets: ["latin"],
  variable: "--font-mono-game-raw",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Push-Up Arena",
    template: "%s — Push-Up Arena",
  },
  description: "Real-time 1v1 push-up tracking arena. Compete live, climb the ELO ladder.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover", // required for safe-area-inset-* to resolve on notched devices
  themeColor: "#090B10",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${displayFont.variable} ${monoGameFont.variable}`}>
      <body className="min-h-dvh bg-base text-white antialiased">{children}</body>
    </html>
  );
}