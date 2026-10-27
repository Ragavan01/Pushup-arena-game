export const ELO_BASE = 50;

export interface EloTierDef {
  label: string;
  color: string;
}

export function getEloTier(elo: number, isTop10: boolean, gender: string = "male"): EloTierDef {
  const isFemale = gender === "female";

  // Base Tiers
  if (elo < 200) return { label: "SUB 3", color: "#6e6e6e" }; // Rusted Iron
  if (elo < 500) return { label: "SUB 5", color: "#b87333" }; // Bronze
  if (elo < 800) return { label: isFemale ? "LTB" : "LTN", color: "#c0c0c0" }; // Silver
  if (elo < 1200) return { label: isFemale ? "MTB" : "MTN", color: "#ffd700" }; // Gold
  if (elo < 1500) return { label: isFemale ? "HTB" : "HTN", color: "#00e5ff" }; // Neon Cyan
  
  // Endgame Tiers (Top 10 Override Logic)
  if (elo >= 2500 && isTop10) {
    return { label: isFemale ? "TRUE EVE" : "TRUE ADAM", color: "#d942ff" }; // Holographic Purple
  }
  
  // Default for 1500+ (Including 2500+ who are NOT in the Top 10)
  return { label: isFemale ? "STACY" : "CHAD", color: "#ff4d4d" }; // Premium Red
}