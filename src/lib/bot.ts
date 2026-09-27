import { BIG_BLIND, getLegalActions, type BetAction } from "@/lib/betting";
import type { Card, GameState, Position, Rank } from "@/lib/poker";

const rankValue: Record<Rank, number> = { A: 14, K: 13, Q: 12, J: 11, "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2 };
const chenPoints = (v: number) => (v === 14 ? 10 : v === 13 ? 8 : v === 12 ? 7 : v === 11 ? 6 : v / 2);
const positionBonus: Record<Position, number> = { UTG: -1, HJ: 0, CO: 1, BTN: 1.5, SB: 0, BB: 0.5 };

/** Chen-formula starting-hand score (roughly -1 to 20). */
export function handScore([a, b]: [Card, Card]): number {
  const hi = Math.max(rankValue[a.rank], rankValue[b.rank]);
  const lo = Math.min(rankValue[a.rank], rankValue[b.rank]);
  if (hi === lo) return Math.max(5, chenPoints(hi) * 2);
  let score = chenPoints(hi);
  if (a.suit === b.suit) score += 2;
  const gap = hi - lo - 1;
  score -= [0, 1, 2, 4][gap] ?? 5;
  if (gap <= 1 && hi < 12) score += 1;
  return Math.ceil(score);
}

/** Simple deterministic rule-based preflop decision for a computer opponent. */
export function decideBotAction(game: GameState): BetAction {
  const legal = getLegalActions(game);
  const player = game.actor === null ? undefined : game.players[game.actor];
  if (!legal || !player) return { type: "fold" };
  const score = handScore(player.cards) + positionBonus[player.position];
  const toCall = legal.callAmount;
  const raiseTo = (target: number): BetAction => {
    if (!legal.canRaise) return legal.canCall ? { type: "call" } : { type: "check" };
    return { type: "raise", to: Math.min(legal.maxRaiseTo, Math.max(legal.minRaiseTo, Math.round(target))) };
  };
  const passive: BetAction = legal.canCheck ? { type: "check" } : { type: "fold" };
  const call: BetAction = legal.canCheck ? { type: "check" } : { type: "call" };

  // Unraised pot (only blinds so far).
  if (game.currentBet <= BIG_BLIND) {
    if (score >= 9) return raiseTo(BIG_BLIND * 3);
    if (score >= 7) return raiseTo(BIG_BLIND * 2.5);
    if (score >= 6 && player.position === "SB") return call;
    return passive;
  }
  // Facing a single raise.
  if (game.currentBet < BIG_BLIND * 8) {
    if (score >= 12) return raiseTo(game.currentBet * 3);
    if (score >= 8 && toCall <= BIG_BLIND * 4) return call;
    if (score >= 10) return call;
    return passive;
  }
  // Facing a 3-bet or more.
  if (score >= 14 && game.currentBet < BIG_BLIND * 25) return raiseTo(game.currentBet * 2.5);
  if (score >= 12) return call;
  if (score >= 10 && toCall <= BIG_BLIND * 6) return call;
  return passive;
}
