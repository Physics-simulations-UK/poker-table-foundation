import type { Card, Position, Rank } from "@/lib/poker";

const rankOrder: Rank[] = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const rankValue = new Map(rankOrder.map((rank, index) => [rank, rankOrder.length - index]));

/** Canonical poker notation: AA, AKs, AKo, T9s, etc. */
export function handNotation([a, b]: [Card, Card]): string {
  const av = rankValue.get(a.rank) ?? 0;
  const bv = rankValue.get(b.rank) ?? 0;
  const high = av >= bv ? a.rank : b.rank;
  const low = av >= bv ? b.rank : a.rank;
  if (high === low) return high + low;
  return `${high}${low}${a.suit === b.suit ? "s" : "o"}`;
}

function pairs(from: Rank): string[] {
  const start = rankOrder.indexOf(from);
  return rankOrder.slice(0, start + 1).map((r) => r + r);
}

function suited(high: Rank, lows: Rank[]): string[] {
  return lows.map((low) => `${high}${low}s`);
}

function offsuit(high: Rank, lows: Rank[]): string[] {
  return lows.map((low) => `${high}${low}o`);
}

const range = (...groups: string[][]) => new Set(groups.flat());

/*
 * 100BB 6-max cash-game baseline RFI ranges.
 *
 * These are intentionally explicit, deterministic training baselines rather
 * than claims of exact solver frequencies. Mixed-frequency hands can be added
 * later when opponent personalities and seeded strategy mixing are introduced.
 */
export const RFI_RANGES: Record<Exclude<Position, "BB">, ReadonlySet<string>> = {
  UTG: range(
    pairs("5"),
    suited("A", ["K", "Q", "J", "10", "9", "5", "4", "3", "2"]),
    suited("K", ["Q", "J", "10"]),
    suited("Q", ["J", "10"]),
    ["J10s", "109s", "98s", "87s"],
    offsuit("A", ["K", "Q", "J"]),
    ["KQo"],
  ),
  HJ: range(
    pairs("4"),
    suited("A", ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]),
    suited("K", ["Q", "J", "10", "9"]),
    suited("Q", ["J", "10", "9"]),
    ["J10s", "J9s", "109s", "98s", "87s", "76s"],
    offsuit("A", ["K", "Q", "J", "10"]),
    offsuit("K", ["Q", "J"]),
    ["QJo"],
  ),
  CO: range(
    pairs("2"),
    suited("A", ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]),
    suited("K", ["Q", "J", "10", "9", "8", "7"]),
    suited("Q", ["J", "10", "9", "8"]),
    suited("J", ["10", "9", "8"]),
    ["109s", "108s", "98s", "97s", "87s", "76s", "65s", "54s"],
    offsuit("A", ["K", "Q", "J", "10", "9"]),
    offsuit("K", ["Q", "J", "10"]),
    offsuit("Q", ["J", "10"]),
    ["J10o"],
  ),
  BTN: range(
    pairs("2"),
    suited("A", ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]),
    suited("K", ["Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]),
    suited("Q", ["J", "10", "9", "8", "7", "6", "5"]),
    suited("J", ["10", "9", "8", "7", "6"]),
    suited("10", ["9", "8", "7", "6"]),
    ["98s", "97s", "96s", "87s", "86s", "76s", "75s", "65s", "64s", "54s", "53s", "43s"],
    offsuit("A", ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]),
    offsuit("K", ["Q", "J", "10", "9", "8"]),
    offsuit("Q", ["J", "10", "9"]),
    offsuit("J", ["10", "9"]),
    ["109o"],
  ),
  SB: range(
    pairs("2"),
    suited("A", ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]),
    suited("K", ["Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"]),
    suited("Q", ["J", "10", "9", "8", "7", "6", "5"]),
    suited("J", ["10", "9", "8", "7"]),
    suited("10", ["9", "8", "7"]),
    ["98s", "97s", "87s", "86s", "76s", "65s", "54s"],
    offsuit("A", ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3"]),
    offsuit("K", ["Q", "J", "10", "9"]),
    offsuit("Q", ["J", "10"]),
    ["J10o"],
  ),
};

export function shouldOpenRaise(cards: [Card, Card], position: Position): boolean {
  if (position === "BB") return false;
  return RFI_RANGES[position].has(handNotation(cards));
}
