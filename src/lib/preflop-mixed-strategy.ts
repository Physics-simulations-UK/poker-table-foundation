import type { Card, Position, Rank } from "@/lib/poker";
import type { StrategyDistribution } from "@/lib/mixed-strategy";

export type PreflopMixedAction = "fold" | "call" | "raise";

const value: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

const positionWidth: Record<Position, number> = {
  UTG: -1.8, HJ: -0.8, CO: 0.6, BTN: 2.0, SB: 1.2, BB: 2.4,
};

function clamp(n: number, low = 0, high = 1) {
  return Math.max(low, Math.min(high, n));
}

/**
 * Continuous preflop quality score. It is not itself a poker decision; it
 * supplies a smooth input so adjacent holdings can mix rather than fall either
 * side of a hard range boundary.
 */
export function preflopQuality([a, b]: [Card, Card]): number {
  const hi = Math.max(value[a.rank], value[b.rank]);
  const lo = Math.min(value[a.rank], value[b.rank]);
  if (hi === lo) return 7 + hi * 0.75;

  let score = hi * 0.62 + lo * 0.22;
  if (a.suit === b.suit) score += 1.15;
  const gap = hi - lo;
  if (gap === 1) score += 1.1;
  else if (gap === 2) score += 0.55;
  else if (gap >= 5) score -= 1.0;
  if (hi === 14) score += 0.55;
  return score;
}

function normalize(fold: number, call: number, raise: number): StrategyDistribution<PreflopMixedAction> {
  const total = fold + call + raise;
  return { fold: fold / total, call: call / total, raise: raise / total };
}

/** Mixed first-in strategy for a 100BB six-max baseline. */
export function mixedFirstInStrategy(
  cards: [Card, Card],
  position: Position,
): StrategyDistribution<PreflopMixedAction> {
  if (position === "BB") return { fold: 0, call: 1, raise: 0 };

  const q = preflopQuality(cards) + positionWidth[position];
  // Strong hands overwhelmingly raise; marginal holdings transition smoothly
  // through mixed raise/fold frequencies rather than a binary chart boundary.
  const raise = clamp((q - 6.4) / 5.2);
  const limp = position === "SB" ? clamp((8.0 - q) / 10, 0, 0.22) : 0;
  const fold = Math.max(0.02, 1 - raise - limp);
  return normalize(fold, limp, raise);
}

/**
 * Mixed response to a single ordinary open. Price is expressed in BB.
 * Later opens and the big blind widen defence; early opens narrow it.
 */
export function mixedVersusOpenStrategy(
  cards: [Card, Card],
  defender: Position,
  opener: Position,
  openSizeBB: number,
): StrategyDistribution<PreflopMixedAction> {
  const lateOpen = opener === "CO" || opener === "BTN" || opener === "SB";
  const earlyOpen = opener === "UTG" || opener === "HJ";
  let q = preflopQuality(cards) + positionWidth[defender] * 0.45;
  if (lateOpen) q += 0.8;
  if (earlyOpen) q -= 0.55;
  if (defender === "BB") q += 1.0;
  q -= Math.max(0, openSizeBB - 2.5) * 0.55;

  const raise = clamp((q - 10.1) / 5.2, 0, 0.82);
  const continueStrength = clamp((q - 5.8) / 5.5);
  let call = clamp(continueStrength - raise * 0.45, 0, 0.82);

  // Suited/connective and paired hands realise equity better as calls.
  const [a, b] = cards;
  const hi = Math.max(value[a.rank], value[b.rank]);
  const lo = Math.min(value[a.rank], value[b.rank]);
  if (a.suit === b.suit || a.rank === b.rank || hi - lo <= 2) call += 0.08;
  call = clamp(call, 0, 0.88);

  const fold = Math.max(0.015, 1 - call - raise);
  return normalize(fold, call, raise);
}

/** Multiway price increases calls while preserving squeeze frequency for strength. */
export function mixedVersusOpenAndCallersStrategy(
  cards: [Card, Card],
  defender: Position,
  opener: Position,
  openSizeBB: number,
): StrategyDistribution<PreflopMixedAction> {
  const base = mixedVersusOpenStrategy(cards, defender, opener, openSizeBB);
  const q = preflopQuality(cards);
  const speculative = cards[0].suit === cards[1].suit || cards[0].rank === cards[1].rank ||
    Math.abs(value[cards[0].rank] - value[cards[1].rank]) <= 2;

  const raise = (base.raise ?? 0) * (q >= 11 ? 1.15 : 0.75);
  const call = (base.call ?? 0) + (speculative ? 0.14 : 0.04);
  const fold = Math.max(0.01, 1 - call - raise);
  return normalize(fold, call, raise);
}
