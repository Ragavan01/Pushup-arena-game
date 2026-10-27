/**
 * components/ui/Button.tsx
 * ------------------------------------------------------------------
 * Every button across login/arena/rankings was hand-styled inline with
 * drifting focus/disabled/loading treatment. This is the one
 * implementation. min-h-11 (44px) satisfies the WCAG 2.2 AA touch
 * target budget; focus-visible ring satisfies G1.
 * ------------------------------------------------------------------
 */

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { LoaderIcon } from "@/components/ui/icons";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-mint to-mint-dim text-black shadow-[0_0_20px_rgba(43,255,176,0.2)] hover:shadow-[0_0_30px_rgba(43,255,176,0.4)]",
  secondary:
    "border border-white/10 bg-white/5 text-white/80 hover:border-white/20 hover:bg-white/10",
  ghost: "text-white/50 hover:text-white",
  danger: "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, fullWidth = false, disabled, className, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "press relative inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-fast",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint",
        "disabled:pointer-events-none disabled:opacity-40",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && <LoaderIcon className="animate-spin" size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
});