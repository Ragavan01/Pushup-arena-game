"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACTIVE_COLOR = "#2BFFB0";
const INACTIVE_COLOR = "rgba(255,255,255,0.45)";

function SwordsIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={color} strokeWidth={2}>
      <path d="M14.5 3.5 21 10l-2 2-6.5-6.5 2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 21l6.5-6.5" strokeLinecap="round" />
      <path d="M9.5 3.5 3 10l2 2 6.5-6.5-2-2z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 21l-6.5-6.5" strokeLinecap="round" />
      <path d="M13 11l2 2" strokeLinecap="round" />
    </svg>
  );
}

function TrophyIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={color} strokeWidth={2}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 5H5a2 2 0 0 0 0 4h3M16 5h3a2 2 0 0 1 0 4h-3" strokeLinecap="round" />
      <path d="M12 12v3M9 19h6M10 19v-2.5c0-.5.3-.9.8-1a5 5 0 0 0 2.4 0c.5.1.8.5.8 1V19" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: "/", label: "Arena", Icon: SwordsIcon },
  { href: "/rankings", label: "Rankings", Icon: TrophyIcon },
] as const;

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#090B10]/90 backdrop-blur-lg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-sm items-stretch justify-around">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          const color = active ? ACTIVE_COLOR : INACTIVE_COLOR;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className="flex flex-col items-center gap-1 py-3 text-[11px] font-semibold transition-colors"
                style={{ color }}
              >
                <Icon color={color} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}