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

function isPair([a, b]: [Card, Card]) {
  return a.rank === b.rank;
}

function highRank([a, b]: [Card, Card]) {
  return Math.max(rankValue[a.rank], rankValue[b.rank]);
}

function lowRank([a, b]: [Card, Card]) {
  return Math.min(rankValue[a.rank], rankValue[b.rank]);
}

/**
 * Stack-aware threshold for calling a preflop all-in.
 *
 * This is deliberately a simple training-game baseline rather than a solver
 * chart. Short shoves are called wider; deep shoves require premium hands.
 * The explicit premium-hand checks stop the previous behaviour where a large
 * bet size caused nearly every bot to fold automatically.
 */
function shouldCallPreflopAllIn(game: GameState, score: number, toCall: number) {
  if (game.actor === null) return false;
  const player = game.players[game.actor];
  if (!player) return false;

  const cards = player.cards;
  const pair = isPair(cards);
  const hi = highRank(cards);
  const lo = lowRank(cards);
  const suited = cards[0].suit === cards[1].suit;
  const callBB = toCall / BIG_BLIND;

  // Always continue with the very top of the range.
  if (pair && hi >= 12) return true; // QQ+
  if (hi === 14 && lo === 13) return true; // AK

  // Short-stack shoves: wider value range.
  if (callBB <= 12) {
    if (pair && hi >= 8) return true; // 88+
    if (hi === 14 && lo >= 10) return true; // AT+
    if (hi === 13 && lo >= 11) return true; // KJ+
    if (suited && hi === 12 && lo >= 11) return true; // QJs
    return score >= 10;
  }

  // Medium shoves: tighten substantially.
  if (callBB <= 25) {
    if (pair && hi >= 10) return true; // TT+
    if (hi === 14 && lo >= 12) return true; // AQ+
    if (suited && hi === 14 && lo === 11) return true; // AJs
    return score >= 12;
  }

  // Deep shoves (including a normal 100BB open shove) should be rare calls,
  // but premium hands must still defend instead of folding mechanically.
  if (pair && hi >= 12) return true; // QQ+
  if (hi === 14 && lo === 13) return true; // AK
  return false;
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

  // Explicitly recognise an opponent's all-in. The raiser's street bet equals
  // their total available chips for this street, so another active player's
  // all-in bet is represented by the current bet being at least their stack
  // commitment. At this stage all players begin the hand equally deep, so a
  // very large current bet also reliably represents the hero's shove.
  const facingAllIn =
    game.currentBet > BIG_BLIND &&
    game.players.some(
      (opponent, seat) =>
        seat !== game.actor &&
        !opponent.folded &&
        opponent.allIn &&
        opponent.streetBet === game.currentBet,
    );

  if (facingAllIn) {
    return shouldCallPreflopAllIn(game, score, toCall) ? call : passive;
  }

  // Unraised pot (only blinds so far).
  if (game.currentBet <= BIG_BLIND) {
    if (score >= 9) return raiseTo(BIG_BLIND * 3);
    if (score >= 7) return raiseTo(BIG_BLIND * 2.5);
    if (score >= 6 && player.position === "SB") return call;
    return passive;
  }
  // Facing a normal single raise. Defend wider in position and from the
  // blinds so ordinary 6-max hands do not collapse to heads-up too often.
  if (game.currentBet < BIG_BLIND * 8) {
    const callBB = toCall / BIG_BLIND;
    const pair = isPair(player.cards);
    const hi = highRank(player.cards);
    const lo = lowRank(player.cards);
    const suited = player.cards[0].suit === player.cards[1].suit;
    const lateOrBlind = ["CO", "BTN", "SB", "BB"].includes(player.position);

    // Keep premium hands aggressive.
    if (score >= 12) return raiseTo(game.currentBet * 3);

    // Strong broadways and medium pairs continue from every position.
    if (pair && hi >= 7 && callBB <= 4) return call; // 77+
    if (hi === 14 && lo >= 10 && callBB <= 4) return call; // AT+
    if (hi === 13 && lo >= 11 && callBB <= 4) return call; // KJ+

    // Later positions and blinds defend useful suited/connective hands wider.
    if (lateOrBlind && callBB <= 3.5) {
      if (pair && hi >= 4) return call; // 44+
      if (suited && hi === 14 && lo >= 7) return call; // A7s+
      if (suited && hi === 13 && lo >= 9) return call; // K9s+
      if (suited && hi === 12 && lo >= 9) return call; // Q9s+
      if (suited && hi === 11 && lo >= 9) return call; // J9s+
      if (suited && hi <= 10 && hi - lo <= 2 && lo >= 6) return call; // suited connectors/gappers
      if (score >= 6.5) return call;
    }

    // HJ/UTG remain tighter, but not as excessively tight as the first model.
    if (score >= 7.5 && callBB <= 3.5) return call;
    return passive;
  }
  // Facing a 3-bet or more.
  if (score >= 14 && game.currentBet < BIG_BLIND * 25) return raiseTo(game.currentBet * 2.5);
  if (score >= 12) return call;
  if (score >= 10 && toCall <= BIG_BLIND * 6) return call;
  return passive;
}
