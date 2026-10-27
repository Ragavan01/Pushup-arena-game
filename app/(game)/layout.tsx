/**
 * app/(game)/layout.tsx
 * ------------------------------------------------------------------
 * Wraps / and /rankings. Adds bottom padding for Navigation's height
 * only here — not globally (audit C1's double-padding-on-rankings /
 * wasted-padding-on-login problem). The arena page itself still needs
 * to be full-bleed during play (audit C2), which it achieves by being
 * a fixed-position overlay above this padding when immersive, not by
 * this layout changing.
 * ------------------------------------------------------------------
 */

import Navigation from "@/components/Navigation";

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-16">
      {children}
      <Navigation />
    </div>
  );
}