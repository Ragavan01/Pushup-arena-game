/**
 * components/ui/icons.tsx
 * ------------------------------------------------------------------
 * One icon per UI concept, all stroke-based line icons at a shared
 * weight so nothing looks like it came from a different set. Every
 * icon uses `currentColor`, so color comes from the caller's text-*
 * class or inline `style={{ color }}` — never hardcode a fill/stroke
 * color inside an icon itself.
 *
 * Replaces: 🥇🥈🥉 → MedalIcon (rank prop 1|2|3), ⭐ → StarIcon,
 * 🔥 → FlameIcon, ⚡ → BoltIcon (audit B5).
 * ------------------------------------------------------------------
 */

export interface IconProps {
  className?: string;
  size?: number;
  strokeWidth?: number;
}

const DEFAULT_SIZE = 16;
const DEFAULT_STROKE = 1.75;

function base(size: number) {
  return { width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const };
}

export function MailIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UserIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.4-5.5 7.5-5.5s6.1 1.9 7.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EyeIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps & { open?: boolean }) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.5 6.7C4 8.3 2 12 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.7-1.2M9.9 5.2A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a15 15 0 0 1-2.2 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SwordsIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M14.5 3.5 21 10l-2 2-6.5-6.5 2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21l6.5-6.5" strokeLinecap="round" />
      <path d="M9.5 3.5 3 10l2 2 6.5-6.5-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 21l-6.5-6.5" strokeLinecap="round" />
      <path d="M13 11l2 2" strokeLinecap="round" />
    </svg>
  );
}

export function TrophyIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 5H5a2 2 0 0 0 0 4h3M16 5h3a2 2 0 0 1 0 4h-3" strokeLinecap="round" />
      <path d="M12 12v3M9 19h6M10 19v-2.5c0-.5.3-.9.8-1a5 5 0 0 0 2.4 0c.5.1.8.5.8 1V19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CheckIcon({ className, size = DEFAULT_SIZE, strokeWidth = 3 }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LoaderIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" strokeLinecap="round" />
    </svg>
  );
}

/** Replaces the 🔥 streak-3-4 emoji. */
export function FlameIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <path
        d="M12 21c4 0 6.5-2.5 6.5-6 0-2.5-1.3-4-2.5-5.5.2 2-.6 3-1.5 3.5.3-2.5-1-4.5-3-6-.3 2-1.2 3.3-2.7 4.7C7.3 12.7 6.5 14 6.5 16c0 3 2.5 5 5.5 5Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Replaces the ⚡ streak-5+ emoji. */
export function BoltIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} fill="currentColor">
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" />
    </svg>
  );
}

/** Replaces the ⭐ season-relic emoji. */
export function StarIcon({ className, size = DEFAULT_SIZE, strokeWidth = DEFAULT_STROKE }: IconProps & { filled?: boolean }) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth} fill="currentColor">
      <path d="M12 2.5l2.9 6.2 6.6.7-5 4.6 1.4 6.6-5.9-3.4-5.9 3.4 1.4-6.6-5-4.6 6.6-.7L12 2.5Z" strokeLinejoin="round" />
    </svg>
  );
}

/** Replaces 🥇🥈🥉. rank 1 = gold, 2 = silver, 3 = bronze. */
export function MedalIcon({
  className,
  size = DEFAULT_SIZE,
  strokeWidth = DEFAULT_STROKE,
  rank,
}: IconProps & { rank: 1 | 2 | 3 }) {
  return (
    <svg {...base(size)} className={className} stroke="currentColor" strokeWidth={strokeWidth}>
      <circle cx="12" cy="14" r="7" />
      <path d="M9 8.5 6 3M15 8.5l3-5.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="17.5" textAnchor="middle" fontSize="8" fontWeight="700" stroke="none" fill="currentColor">
        {rank}
      </text>
    </svg>
  );
}