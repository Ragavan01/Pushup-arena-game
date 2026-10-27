import { createClient } from "@supabase/supabase-js";
import { getEloTier } from "@/lib/elo";

export const revalidate = 30;

interface LeaderboardRow {
  id: string;
  username: string;
  gender: "male" | "female" | "unspecified";
  elo: number;
  wins: number;
  losses: number;
  is_top10: boolean;
  global_rank: number;
  season_badges: string[];
}

async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase
    .from("leaderboard_top100")
    .select("*")
    .order("global_rank", { ascending: true });

  if (error) {
    console.error("Failed to load leaderboard:", error.message);
    return [];
  }
  return (data as LeaderboardRow[]) ?? [];
}

function initialsFor(username: string): string {
  return username.trim().slice(0, 2).toUpperCase() || "??";
}

export default async function RankingsPage() {
  const rows = await getLeaderboard();
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <main className="min-h-screen w-full bg-[#090B10] px-4 pb-24 pt-8 font-sans text-white">
      <div className="relative mx-auto max-w-sm">
        <header className="mb-6 text-center">
          <p className="pua-display bg-gradient-to-r from-[#2BFFB0] to-[#FF5C3E] bg-clip-text text-4xl text-transparent">
            Global Rankings
          </p>
          <p className="mt-1 text-xs text-white/40">Top 100 push-up arena competitors</p>
        </header>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
            No ranked players yet — finish a match to appear on the board.
          </p>
        ) : (
          <>
            {podium.length > 0 && <Podium rows={podium} />}

            <ol className="mt-6 space-y-2">
              {rest.map((row) => (
                <RankRow key={row.id} row={row} />
              ))}
            </ol>
          </>
        )}
      </div>
    </main>
  );
}

function Podium({ rows }: { rows: LeaderboardRow[] }) {
  const first = rows.find((r) => r.global_rank === 1);
  const second = rows.find((r) => r.global_rank === 2);
  const third = rows.find((r) => r.global_rank === 3);

  const ordered = [
    { row: second, heightClass: "h-24", medal: "🥈" },
    { row: first, heightClass: "h-32", medal: "🥇" },
    { row: third, heightClass: "h-20", medal: "🥉" },
  ];

  return (
    <div className="flex items-end justify-center gap-3">
      {ordered.map(({ row, heightClass, medal }, i) => {
        if (!row) return <div key={i} className="w-1/3" />;
        const tier = getEloTier(row.elo, row.is_top10, row.gender);
        return (
          <div key={row.id} className="flex w-1/3 flex-col items-center gap-2">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-bold"
              style={{ borderColor: tier.color, backgroundColor: `${tier.color}22`, color: tier.color }}
            >
              {initialsFor(row.username)}
            </div>
            <p className="truncate text-xs font-semibold text-white/90">{row.username}</p>
            <p className="pua-mono text-[10px]" style={{ color: tier.color }}>
              {tier.label}
            </p>
            <div
              className={`flex w-full ${heightClass} flex-col items-center justify-start gap-1 rounded-t-xl border border-white/10 bg-gradient-to-b from-white/10 to-transparent pt-2`}
            >
              <span className="text-xl">{medal}</span>
              <span className="pua-mono text-sm font-bold text-white">{row.elo}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankRow({ row }: { row: LeaderboardRow }) {
  const tier = getEloTier(row.elo, row.is_top10, row.gender);
  const totalMatches = row.wins + row.losses;
  const winRate = totalMatches === 0 ? null : Math.round((row.wins / totalMatches) * 100);
  const hasLegacy = row.season_badges && row.season_badges.length > 0;

  return (
    <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
      <span className="pua-mono w-6 shrink-0 text-center text-xs font-bold text-white/40">
        {row.global_rank}
      </span>
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
        style={{ backgroundColor: `${tier.color}22`, color: tier.color }}
      >
        {initialsFor(row.username)}
        {hasLegacy && (
          <div className="absolute -top-1.5 -right-1.5 flex h-4 items-center justify-center rounded-full bg-gradient-to-br from-[#FFE066] to-[#F59E0B] px-1 shadow-[0_0_8px_rgba(245,158,11,0.6)]">
             <span className="text-[8px] font-black text-black">⭐{row.season_badges.length}</span>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white/90">{row.username}</p>
        <div className="flex items-center gap-2">
          <p className="pua-mono text-[10px]" style={{ color: tier.color }}>
            {tier.label}
          </p>
          {winRate !== null && (
            <p className="text-[10px] text-white/35">{winRate}% win rate</p>
          )}
        </div>
      </div>
      <span className="pua-mono shrink-0 text-sm font-bold text-white/90">{row.elo}</span>
    </li>
  );
}