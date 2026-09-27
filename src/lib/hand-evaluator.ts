import type { Card, Rank } from "@/lib/poker";

export type HandCategory =
  | "high-card"
  | "pair"
  | "two-pair"
  | "three-of-a-kind"
  | "straight"
  | "flush"
  | "full-house"
  | "four-of-a-kind"
  | "straight-flush";

export interface HandValue {
  category: HandCategory;
  /** Higher numbers are stronger. */
  categoryRank: number;
  /** Lexicographic tiebreak values, highest first. */
  tiebreakers: number[];
  /** The five cards that make this value. */
  cards: Card[];
}

const rankValue: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

function compareNumbers(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function compareHandValues(a: HandValue, b: HandValue): number {
  return a.categoryRank - b.categoryRank || compareNumbers(a.tiebreakers, b.tiebreakers);
}

function straightHigh(values: number[]): number | null {
  const unique = [...new Set(values)].sort((a, b) => b - a);
  // Ace can also play low in A-2-3-4-5.
  if (unique.includes(14)) unique.push(1);
  for (let i = 0; i <= unique.length - 5; i++) {
    const window = unique.slice(i, i + 5);
    if (window.every((value, index) => index === 0 || value === (window[index - 1] ?? value) - 1)) {
      return window[0] ?? null;
    }
  }
  return null;
}

function evaluateFive(cards: Card[]): HandValue {
  if (cards.length !== 5) throw new Error("A five-card hand is required");

  const values = cards.map((card) => rankValue[card.rank]).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every((card) => card.suit === cards[0]?.suit);
  const highStraight = straightHigh(values);

  if (flush && highStraight !== null) {
    return { category: "straight-flush", categoryRank: 8, tiebreakers: [highStraight], cards };
  }

  if (groups[0]?.[1] === 4) {
    return { category: "four-of-a-kind", categoryRank: 7, tiebreakers: [groups[0][0], groups[1]?.[0] ?? 0], cards };
  }

  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    return { category: "full-house", categoryRank: 6, tiebreakers: [groups[0][0], groups[1][0]], cards };
  }

  if (flush) {
    return { category: "flush", categoryRank: 5, tiebreakers: values, cards };
  }

  if (highStraight !== null) {
    return { category: "straight", categoryRank: 4, tiebreakers: [highStraight], cards };
  }

  if (groups[0]?.[1] === 3) {
    const kickers = groups.slice(1).map(([value]) => value).sort((a, b) => b - a);
    return { category: "three-of-a-kind", categoryRank: 3, tiebreakers: [groups[0][0], ...kickers], cards };
  }

  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups.find(([, count]) => count === 1)?.[0] ?? 0;
    return { category: "two-pair", categoryRank: 2, tiebreakers: [highPair, lowPair, kicker], cards };
  }

  if (groups[0]?.[1] === 2) {
    const kickers = groups.slice(1).map(([value]) => value).sort((a, b) => b - a);
    return { category: "pair", categoryRank: 1, tiebreakers: [groups[0][0], ...kickers], cards };
  }

  return { category: "high-card", categoryRank: 0, tiebreakers: values, cards };
}

function combinationsOfFive(cards: Card[]): Card[][] {
  const combinations: Card[][] = [];
  for (let a = 0; a < cards.length - 4; a++)
    for (let b = a + 1; b < cards.length - 3; b++)
      for (let c = b + 1; c < cards.length - 2; c++)
        for (let d = c + 1; d < cards.length - 1; d++)
          for (let e = d + 1; e < cards.length; e++) {
            const combo = [cards[a], cards[b], cards[c], cards[d], cards[e]];
            if (combo.every((card): card is Card => card !== undefined)) combinations.push(combo);
          }
  return combinations;
}

export function evaluateHand(cards: Card[]): HandValue {
  if (cards.length < 5 || cards.length > 7) throw new Error("Poker hand evaluation requires 5 to 7 cards");
  const values = combinationsOfFive(cards).map(evaluateFive);
  const best = values.reduce((strongest, candidate) =>
    compareHandValues(candidate, strongest) > 0 ? candidate : strongest,
  );
  return best;
}

export function compareHands(a: Card[], b: Card[]): number {
  return compareHandValues(evaluateHand(a), evaluateHand(b));
}
