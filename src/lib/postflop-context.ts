import type { Card, GameState, Rank } from "@/lib/poker";
import { potTotal } from "@/lib/betting";

const rankValue: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

export type BoardPairedness = "unpaired" | "paired" | "double-paired" | "trips";
export type BoardConnectivity = "disconnected" | "connected" | "highly-connected";
export type BoardSuitTexture = "rainbow" | "two-tone" | "monotone";

export interface BoardTexture {
  pairedness: BoardPairedness;
  connectivity: BoardConnectivity;
  suitTexture: BoardSuitTexture;
  highCard: number;
}

export interface PostflopContext {
  pot: number;
  toCall: number;
  potOdds: number;
  spr: number;
  activeOpponents: number;
  inPosition: boolean;
  board: BoardTexture;
}

function boardPairedness(board: Card[]): BoardPairedness {
  const counts = [...new Set(board.map((c) => c.rank))]
    .map((rank) => board.filter((c) => c.rank === rank).length)
    .sort((a, b) => b - a);
  if ((counts[0] ?? 0) >= 3) return "trips";
  if ((counts[0] ?? 0) === 2 && (counts[1] ?? 0) === 2) return "double-paired";
  if ((counts[0] ?? 0) === 2) return "paired";
  return "unpaired";
}

function suitTexture(board: Card[]): BoardSuitTexture {
  const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
  const max = Math.max(...suits.map((suit) => board.filter((c) => c.suit === suit).length));
  if (max >= 3) return "monotone";
  if (max === 2) return "two-tone";
  return "rainbow";
}

function connectivity(board: Card[]): BoardConnectivity {
  const values = [...new Set(board.map((c) => rankValue[c.rank]))];
  if (values.includes(14)) values.push(1);
  let bestWindow = 0;
  for (let low = 1; low <= 10; low++) {
    const count = values.filter((v) => v >= low && v <= low + 4).length;
    bestWindow = Math.max(bestWindow, count);
  }
  if (bestWindow >= 4) return "highly-connected";
  if (bestWindow >= 3) return "connected";
  return "disconnected";
}

export function analyzeBoardTexture(board: Card[]): BoardTexture {
  if (board.length < 3 || board.length > 5) throw new Error("Board texture requires 3 to 5 cards");
  return {
    pairedness: boardPairedness(board),
    connectivity: connectivity(board),
    suitTexture: suitTexture(board),
    highCard: Math.max(...board.map((c) => rankValue[c.rank])),
  };
}

export function calculatePotOdds(pot: number, toCall: number): number {
  if (toCall <= 0) return 0;
  return toCall / (pot + toCall);
}

export function calculateSPR(stack: number, opponentStacks: number[], pot: number): number {
  if (pot <= 0) return Number.POSITIVE_INFINITY;
  const live = opponentStacks.filter((stack) => stack > 0);
  const effective = live.length === 0 ? stack : Math.min(stack, Math.max(...live));
  return effective / pot;
}

const positionOrder = ["SB", "BB", "UTG", "HJ", "CO", "BTN"] as const;

export function analyzePostflopContext(game: GameState, board: Card[]): PostflopContext {
  if (game.actor === null) throw new Error("Postflop context requires an acting player");
  const actor = game.players[game.actor]!;
  const opponents = game.players.filter((p, seat) => seat !== game.actor && !p.folded);
  const pot = potTotal(game);
  const toCall = Math.max(0, game.currentBet - actor.streetBet);
  const actorPosition = positionOrder.indexOf(actor.position);
  const laterActive = opponents.some((p) => positionOrder.indexOf(p.position) > actorPosition);

  return {
    pot,
    toCall,
    potOdds: calculatePotOdds(pot, toCall),
    spr: calculateSPR(actor.stack, opponents.map((p) => p.stack), pot),
    activeOpponents: opponents.length,
    inPosition: !laterActive,
    board: analyzeBoardTexture(board),
  };
}
