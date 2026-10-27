/**
 * components/ui/Field.tsx
 * ------------------------------------------------------------------
 * Fixes audit E2 directly: every login input previously had no
 * <label> (placeholder-as-label fails screen readers and disappears
 * once the user types), no autoComplete/inputMode, and no error
 * association. This wires a real <label htmlFor>, aria-describedby
 * pointing at the error text, aria-invalid, and passes autoComplete/
 * inputMode straight through to the underlying <input>.
 *
 * The label is visually a small uppercase caption above the input
 * (matches the brand's mono/uppercase micro-label language) rather
 * than a floating label — simpler to get right accessibly, and the
 * experience_spec explicitly allows either.
 * ------------------------------------------------------------------
 */

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
}

export function Field({ label, error, icon, trailing, id, className, ...props }: FieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className="px-1 font-mono-game text-[10px] font-bold uppercase tracking-[0.15em] text-white/50"
      >
        {label}
      </label>
      <div className="group relative">
        {icon && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/30 transition-colors group-focus-within:text-mint">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pr-4 text-sm text-white outline-none transition-all",
            "font-mono-game placeholder:text-white/20",
            "focus:border-mint focus:bg-black/80 focus:shadow-[0_0_0_3px_rgba(43,255,176,0.12),inset_0_1px_2px_rgba(0,0,0,0.4)]",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint",
            icon ? "pl-11" : "pl-4",
            trailing ? "pr-11" : "pr-4",
            error && "border-danger/50",
            className
          )}
          {...props}
        />
        {trailing && <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      {error && (
        <p id={errorId} role="alert" className="px-1 text-[11px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}