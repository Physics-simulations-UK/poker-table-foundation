import { evaluateHand, type HandCategory, type HandValue } from "@/lib/hand-evaluator";
import type { Card, Rank, Suit } from "@/lib/poker";

const rankValue: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

export type PairClass = "overpair" | "top-pair" | "middle-or-lower-pair" | "pocket-pair-below-board" | null;
export type StraightDraw = "open-ended" | "gutshot" | null;

export interface PostflopAnalysis {
  madeHand: HandCategory;
  handValue: HandValue;
  pairClass: PairClass;
  flushDraw: boolean;
  straightDraw: StraightDraw;
  /** Number of distinct rank values that complete a straight on the next card. */
  straightOutRanks: number[];
  /** True when at least one hole card is used by the evaluator's best five. */
  usesHoleCard: boolean;
}

function cardKey(card: Card) {
  return `${card.rank}-${card.suit}`;
}

function distinctValues(cards: Card[]): number[] {
  const values = [...new Set(cards.map((card) => rankValue[card.rank]))];
  if (values.includes(14)) values.push(1); // ace can be low
  return values;
}

function straightCompletionRanks(cards: Card[]): number[] {
  const have = new Set(distinctValues(cards));
  const outs = new Set<number>();
  for (let high = 5; high <= 14; high++) {
    const run = high === 5 ? [5, 4, 3, 2, 1] : [high, high - 1, high - 2, high - 3, high - 4];
    const missing = run.filter((value) => !have.has(value));
    if (missing.length === 1) outs.add(missing[0] === 1 ? 14 : missing[0]!);
  }
  return [...outs].sort((a, b) => a - b);
}

function classifyStraightDraw(cards: Card[]): { draw: StraightDraw; outs: number[] } {
  const outs = straightCompletionRanks(cards);
  if (outs.length >= 2) return { draw: "open-ended", outs };
  if (outs.length === 1) return { draw: "gutshot", outs };
  return { draw: null, outs };
}

function hasFlushDraw(cards: Card[]): boolean {
  const counts = new Map<Suit, number>();
  for (const card of cards) counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  return [...counts.values()].some((count) => count === 4);
}

function classifyPair(hole: [Card, Card], board: Card[], madeHand: HandCategory): PairClass {
  if (madeHand !== "pair") return null;
  const boardValues = [...new Set(board.map((card) => rankValue[card.rank]))].sort((a, b) => b - a);
  const [a, b] = hole;
  const av = rankValue[a.rank];
  const bv = rankValue[b.rank];

  if (a.rank === b.rank) {
    const highestBoard = boardValues[0] ?? 0;
    return av > highestBoard ? "overpair" : "pocket-pair-below-board";
  }

  const pairedHoleValues = [av, bv].filter((value) => boardValues.includes(value));
  if (pairedHoleValues.length === 0) return null;
  const best = Math.max(...pairedHoleValues);
  return best === (boardValues[0] ?? 0) ? "top-pair" : "middle-or-lower-pair";
}

/**
 * Analyse the hero/bot's current postflop hand using only visible cards.
 * Board must contain the currently revealed 3-5 community cards.
 */
export function analyzePostflop(hole: [Card, Card], board: Card[]): PostflopAnalysis {
  if (board.length < 3 || board.length > 5) throw new Error("Postflop analysis requires 3 to 5 board cards");
  const all = [...hole, ...board];
  const handValue = evaluateHand(all);
  const straight = classifyStraightDraw(all);
  const bestKeys = new Set(handValue.cards.map(cardKey));
  const usesHoleCard = hole.some((card) => bestKeys.has(cardKey(card)));

  return {
    madeHand: handValue.category,
    handValue,
    pairClass: classifyPair(hole, board, handValue.category),
    flushDraw: handValue.category === "flush" || handValue.category === "straight-flush" ? false : hasFlushDraw(all),
    straightDraw: handValue.category === "straight" || handValue.category === "straight-flush" ? null : straight.draw,
    straightOutRanks: handValue.category === "straight" || handValue.category === "straight-flush" ? [] : straight.outs,
    usesHoleCard,
  };
}
