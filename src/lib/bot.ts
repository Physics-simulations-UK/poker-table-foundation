import { BIG_BLIND, getLegalActions, potTotal, type BetAction } from "@/lib/betting";
import type { Card, GameState, Position, Rank } from "@/lib/poker";
import { actionVersusFourBet, actionVersusThreeBet } from "@/lib/preflop-strategy";
import { mixedFirstInStrategy, mixedVersusOpenAndCallersStrategy, mixedVersusOpenStrategy } from "@/lib/preflop-mixed-strategy";
import { chooseMixedAction } from "@/lib/mixed-strategy";
import { analyzePostflop } from "@/lib/postflop-analysis";
import { analyzePostflopContext } from "@/lib/postflop-context";
import { mixedPostflopStrategy } from "@/lib/postflop-mixed-strategy";
import { postflopBetSizeStrategy, potFractionForSize } from "@/lib/postflop-bet-sizing";
import { riverEquityFromHistory, turnEquityFromHistory } from "@/lib/range-from-history";
import { equityAdjustedRiverStrategy } from "@/lib/river-equity-strategy";

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
export function decideBotAction(game: GameState, strategyRoll?: number, sizingRoll?: number): BetAction {
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

  // v0.4 positional intelligence is deliberately preflop-only. Postflop keeps
  // the existing deterministic fallback until a board-aware strategy arrives.
  if (game.street === "preflop") {
    // Unopened pot (only the blinds have been posted).
    if (game.currentBet <= BIG_BLIND) {
      const intention = chooseMixedAction(
        mixedFirstInStrategy(player.cards, player.position),
        strategyRoll,
      ).action;
      if (intention === "raise") return raiseTo(BIG_BLIND * 2.5);
      if (intention === "call") return call;
      return passive;
    }

    // Identify a single ordinary opener from the live street state. A player
    // whose street bet equals currentBet and whose last action was a raise is
    // the opener. If the state is more complex, fall through to the legacy
    // conservative 3-bet+ handling below.
    const raiseActors = game.players.filter(
      (opponent, seat) =>
        seat !== game.actor &&
        !opponent.folded &&
        opponent.lastAction?.startsWith("RAISE TO"),
    );
    const callersAtPrice = game.players.filter(
      (opponent, seat) =>
        seat !== game.actor &&
        !opponent.folded &&
        opponent.streetBet === game.currentBet &&
        opponent.lastAction?.startsWith("CALL"),
    );

    // One ordinary open. Crucially, callers no longer make this look like a
    // 3-bet pot: later seats can overcall or squeeze using multiway ranges.
    if (game.currentBet < BIG_BLIND * 8 && raiseActors.length === 1) {
      const opener = raiseActors[0]!;
      const openSizeBB = game.currentBet / BIG_BLIND;
      const strategy = callersAtPrice.length > 0
        ? mixedVersusOpenAndCallersStrategy(player.cards, player.position, opener.position, openSizeBB)
        : mixedVersusOpenStrategy(player.cards, player.position, opener.position, openSizeBB);
      const intention = chooseMixedAction(strategy, strategyRoll).action;
      if (intention === "raise") return raiseTo(game.currentBet * 3);
      if (intention === "call") return call;
      return passive;
    }

    // Once a second raise has occurred, use the bot's own earlier action to
    // distinguish defending its open from facing a later 4-bet.
    if (game.currentBet < BIG_BLIND * 25 && raiseActors.length >= 2) {
      const priorRaise = player.lastAction?.startsWith("RAISE TO") ?? false;
      const priorCommitment = player.streetBet / BIG_BLIND;

      if (priorRaise && priorCommitment <= 4) {
        const intention = actionVersusThreeBet(player.cards, player.position);
        if (intention === "4bet") return raiseTo(game.currentBet * 2.3);
        if (intention === "call") return call;
        return passive;
      }

      if (priorRaise && priorCommitment > 4) {
        const intention = actionVersusFourBet(player.cards);
        if (intention === "5bet") return raiseTo(legal.maxRaiseTo);
        if (intention === "call") return call;
        return passive;
      }
    }
  }

  // Board-aware postflop strategy: judge the hand we have now rather than
  // continuing to use the strength of the two cards dealt preflop.
  if (game.street === "flop" || game.street === "turn" || game.street === "river") {
    const board = game.communityCards.slice(0, game.revealedCount);
    const hand = analyzePostflop(player.cards, board);
    const context = analyzePostflopContext(game, board);
    const baselineStrategy = mixedPostflopStrategy(hand, context);
    let strategy = baselineStrategy;

    // v0.5: in heads-up river spots facing a bet, adjust the existing mixed
    // strategy using exact equity versus the opponent's range reconstructed
    // from the complete observed hand history. Other postflop spots are
    // intentionally unchanged.
    if ((game.street === "turn" || game.street === "river") && context.toCall > 0 && context.activeOpponents === 1) {
      const opponentSeat = game.players.findIndex(
        (opponent, seat) => seat !== game.actor && !opponent.folded,
      );
      if (opponentSeat >= 0) {
        const equity = game.street === "river" ? riverEquityFromHistory(game, game.actor!, opponentSeat).equity : turnEquityFromHistory(game, game.actor!, opponentSeat).equity;
        strategy = equityAdjustedRiverStrategy(
          {
            fold: baselineStrategy.fold ?? 0,
            call: (baselineStrategy.call ?? 0) + (baselineStrategy.check ?? 0),
            raise: (baselineStrategy.raise ?? 0) + (baselineStrategy["bet-small"] ?? 0) + (baselineStrategy["bet-medium"] ?? 0),
          },
          equity,
          context.potOdds,
        );
      }
    }

    const intention = chooseMixedAction(strategy, strategyRoll).action;
    const pot = potTotal(game);
    const sampledBetTarget = () => {
      const size = chooseMixedAction(postflopBetSizeStrategy(hand, context), sizingRoll ?? strategyRoll).action;
      return player.streetBet + Math.max(BIG_BLIND, pot * potFractionForSize(size));
    };

    switch (intention) {
      case "fold":
        return passive;
      case "check":
        return legal.canCheck ? { type: "check" } : call;
      case "call":
        return call;
      case "bet-small":
        return raiseTo(sampledBetTarget());
      case "bet-medium":
        return raiseTo(sampledBetTarget());
      case "raise": {
        // When facing a bet, use roughly a 3x raise. If checked to, a strong
        // hand uses a medium value bet instead.
        const target = game.currentBet > player.streetBet
          ? game.currentBet * 3
          : sampledBetTarget();
        return raiseTo(target);
      }
    }
  }

  return passive;
}
