import type { Card, Rank, Suit } from "@/lib/poker";

const rankValue: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

export type BoardWetness = "dry" | "semi-wet" | "wet";
export interface BoardTexture {
  paired: boolean;
  monotone: boolean;
  twoTone: boolean;
  connected: boolean;
  highCard: number;
  wetness: BoardWetness;
}

/** Required equity to call, expressed from 0 to 1. */
export function potOdds(potBeforeCall: number, callAmount: number): number {
  if (callAmount <= 0) return 0;
  const finalPotIfCalled = potBeforeCall + callAmount;
  return finalPotIfCalled > 0 ? callAmount / finalPotIfCalled : 0;
}

/** Effective-stack-to-pot ratio. */
export function stackToPotRatio(effectiveStack: number, pot: number): number {
  if (pot <= 0) return Number.POSITIVE_INFINITY;
  return Math.max(0, effectiveStack) / pot;
}

function longestConnectedRun(values: number[]): number {
  const unique = [...new Set(values)].sort((a, b) => a - b);
  if (unique.includes(14)) unique.unshift(1);
  let best = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const gap = (unique[i] ?? 0) - (unique[i - 1] ?? 0);
    if (gap <= 2) run += 1;
    else run = 1;
    best = Math.max(best, run);
  }
  return best;
}

export function analyzeBoardTexture(board: Card[]): BoardTexture {
  if (board.length < 3 || board.length > 5) throw new Error("Board texture requires 3 to 5 cards");

  const values = board.map((card) => rankValue[card.rank]);
  const uniqueRanks = new Set(values);
  const suitCounts = new Map<Suit, number>();
  for (const card of board) suitCounts.set(card.suit, (suitCounts.get(card.suit) ?? 0) + 1);
  const maxSuit = Math.max(...suitCounts.values());
  const paired = uniqueRanks.size < board.length;
  const monotone = board.length === 3 && maxSuit === 3;
  const twoTone = board.length === 3 && maxSuit === 2;
  const connected = longestConnectedRun(values) >= 3;

  let danger = 0;
  if (monotone) danger += 2;
  else if (twoTone || maxSuit >= 3) danger += 1;
  if (connected) danger += 2;
  if (paired) danger += 1;

  return {
    paired,
    monotone,
    twoTone,
    connected,
    highCard: Math.max(...values),
    wetness: danger >= 3 ? "wet" : danger >= 1 ? "semi-wet" : "dry",
  };
}
