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


export type VersusOpenAction = "fold" | "call" | "3bet";

const THREE_BET_VALUE = new Set(["AA", "KK", "QQ", "JJ", "AKs", "AKo"]);
const THREE_BET_LATE = new Set(["1010", "AQs", "AQo", "AJs", "KQs"]);
const THREE_BET_BLIND = new Set(["1010", "99", "AQs", "AQo", "AJs", "A5s", "A4s", "KQs"]);

const CALL_EARLY_OPEN = new Set([
  "1010", "99", "88", "77", "66",
  "AQs", "AJs", "A10s", "KQs", "KJs", "QJs", "J10s", "109s", "98s",
  "AQo",
]);

const CALL_LATE_OPEN = new Set([
  "88", "77", "66", "55", "44", "33", "22",
  "A10s", "A9s", "A8s", "A7s", "A6s", "A5s", "A4s", "A3s", "A2s",
  "KJs", "K10s", "K9s", "QJs", "Q10s", "Q9s", "J10s", "J9s",
  "109s", "98s", "87s", "76s", "65s",
  "AJo", "A10o", "KQo", "KJo", "QJo",
]);

const CALL_BIG_BLIND = new Set([
  ...CALL_EARLY_OPEN,
  ...CALL_LATE_OPEN,
  "K8s", "K7s", "Q8s", "J8s", "108s", "97s", "86s", "75s", "54s",
  "A9o", "K10o", "Q10o", "J10o",
]);

/**
 * Deterministic 100BB baseline response to one ordinary open raise.
 *
 * The opener's position matters: an early-position open is respected more,
 * while CO/BTN/SB opens are defended more widely. The BB receives the widest
 * calling range because it closes the action and has already invested 1BB.
 * Mixed-frequency solver actions are intentionally deferred to a later layer.
 */
export function actionVersusOpen(
  cards: [Card, Card],
  defender: Position,
  opener: Position,
): VersusOpenAction {
  const hand = handNotation(cards);
  const earlyOpen = opener === "UTG" || opener === "HJ";
  const lateOpen = opener === "CO" || opener === "BTN" || opener === "SB";

  if (THREE_BET_VALUE.has(hand)) return "3bet";

  // Widen value/semi-value 3-bets against steals, especially from the blinds.
  if (lateOpen && (defender === "SB" || defender === "BB") && THREE_BET_BLIND.has(hand)) {
    return "3bet";
  }
  if (lateOpen && THREE_BET_LATE.has(hand)) return "3bet";

  if (defender === "BB") {
    if (CALL_BIG_BLIND.has(hand)) return "call";
    return "fold";
  }

  if (earlyOpen) {
    return CALL_EARLY_OPEN.has(hand) ? "call" : "fold";
  }

  return CALL_LATE_OPEN.has(hand) ? "call" : "fold";
}
