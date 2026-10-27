/**
 * components/ui/GlassPanel.tsx
 * ------------------------------------------------------------------
 * The frosted-glass card treatment (border, blur, inner glow) appeared
 * hand-copied on the login card and would otherwise get re-copied into
 * the lobby sheet and results screen in later phases. One
 * implementation, with the HUD corner-bracket motif as an opt-in prop
 * since not every surface should have it (e.g. HUD sub-panels).
 * ------------------------------------------------------------------
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function GlassPanel({
  children,
  brackets = false,
  glow = "mint",
  className,
}: {
  children: ReactNode;
  /** HUD-style corner brackets — use for primary surfaces (login card, results), not nested sub-panels. */
  brackets?: boolean;
  glow?: "mint" | "coral" | "none";
  className?: string;
}) {
  const glowShadow =
    glow === "mint"
      ? "shadow-[0_0_100px_rgba(43,255,176,0.06)]"
      : glow === "coral"
        ? "shadow-[0_0_100px_rgba(255,92,62,0.06)]"
        : "";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-black/40 backdrop-blur-2xl",
        glowShadow,
        className
      )}
    >
      {brackets && (
        <>
          <span className="pointer-events-none absolute left-3 top-3 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-mint/40" aria-hidden="true" />
          <span className="pointer-events-none absolute right-3 top-3 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-mint/40" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-3 left-3 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-mint/40" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-3 right-3 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-mint/40" aria-hidden="true" />
        </>
      )}
      {children}
    </div>
  );
}