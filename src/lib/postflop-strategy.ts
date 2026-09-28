import type { PostflopAnalysis } from "@/lib/postflop-analysis";
import type { PostflopContext } from "@/lib/postflop-context";

export type PostflopIntention =
  | "fold"
  | "check"
  | "call"
  | "bet-small"
  | "bet-medium"
  | "raise";

const veryStrong = new Set([
  "straight-flush", "four-of-a-kind", "full-house", "flush", "straight", "three-of-a-kind",
]);

function facingBet(context: PostflopContext) {
  return context.toCall > 0;
}

function wetBoard(context: PostflopContext) {
  return context.board.suitTexture !== "rainbow" || context.board.connectivity !== "disconnected";
}

function strongDraw(hand: PostflopAnalysis) {
  return hand.flushDraw || hand.straightDraw === "open-ended";
}

/**
 * Deterministic baseline postflop policy.
 *
 * This is intentionally explainable rather than pretending to reproduce an
 * exact solver. It uses current hand class, draw quality, price, SPR, board
 * texture, position and number of opponents. Mixed-frequency play comes later.
 */
export function decidePostflop(
  hand: PostflopAnalysis,
  context: PostflopContext,
): PostflopIntention {
  const bet = facingBet(context);
  const multiway = context.activeOpponents >= 2;
  const wet = wetBoard(context);

  // Strong made hands build the pot. On dangerous/multiway boards they protect
  // equity; with very low SPR they are comfortable playing for stacks.
  if (veryStrong.has(hand.madeHand)) {
    if (bet) return "raise";
    return wet || multiway || context.spr <= 3 ? "bet-medium" : "bet-small";
  }

  if (hand.madeHand === "two-pair") {
    if (bet) {
      if (context.potOdds <= 0.4 || context.spr <= 4) return "raise";
      return "call";
    }
    return wet || multiway ? "bet-medium" : "bet-small";
  }

  // Overpairs and top pair are legitimate continuing hands, but avoid treating
  // one pair as the nuts on coordinated multiway boards.
  if (hand.madeHand === "pair" && (hand.pairClass === "overpair" || hand.pairClass === "top-pair")) {
    if (bet) {
      if (context.potOdds > 0.45 && (wet || multiway) && context.spr > 4) return "fold";
      return "call";
    }
    return wet || multiway ? "bet-medium" : "bet-small";
  }

  // Strong draws continue at ordinary prices. Combo draws can be upgraded to
  // semi-bluff raises, particularly heads-up.
  if (strongDraw(hand)) {
    const comboDraw = hand.flushDraw && hand.straightDraw !== null;
    if (bet) {
      if (comboDraw && !multiway) return "raise";
      if (context.potOdds <= 0.36) return "call";
      return "fold";
    }
    return context.inPosition && !multiway ? "bet-medium" : "check";
  }

  // Weaker pairs retain showdown value but become price-sensitive.
  if (hand.madeHand === "pair") {
    if (bet) {
      if (context.potOdds <= 0.25 && !multiway) return "call";
      return "fold";
    }
    return "check";
  }

  // Gutshots can peel cheaply heads-up, especially in position.
  if (hand.straightDraw === "gutshot") {
    if (bet) {
      if (!multiway && context.potOdds <= 0.2) return "call";
      return "fold";
    }
    return context.inPosition && !multiway ? "bet-small" : "check";
  }

  // High-card/no-draw hands mostly give up. Allow a restrained positional
  // stab on dry heads-up boards so bots are not perfectly face-up.
  if (!bet && context.inPosition && !multiway && !wet) return "bet-small";
  return bet ? "fold" : "check";
}
