import type { StrategyDistribution } from "@/lib/mixed-strategy";
import type { PostflopAnalysis } from "@/lib/postflop-analysis";
import type { PostflopContext } from "@/lib/postflop-context";

export type MixedPostflopAction = "fold" | "check" | "call" | "bet-small" | "bet-medium" | "raise";

function weights(
  values: StrategyDistribution<MixedPostflopAction>,
): StrategyDistribution<MixedPostflopAction> {
  return values;
}

function wet(context: PostflopContext) {
  return context.board.suitTexture !== "rainbow" || context.board.connectivity !== "disconnected";
}

const monsters = new Set(["straight-flush", "four-of-a-kind", "full-house", "flush", "straight", "three-of-a-kind"]);

/**
 * GTO-oriented mixed postflop baseline.
 *
 * These frequencies are intentionally heuristic rather than claimed solver
 * outputs. They make strategically credible actions available at mixed
 * frequencies using hand strength, draw quality, price, board texture, SPR,
 * position and player count. A future solver-data adapter can replace the
 * weights without changing the sampling API.
 */
export function mixedPostflopStrategy(
  hand: PostflopAnalysis,
  context: PostflopContext,
): StrategyDistribution<MixedPostflopAction> {
  const facingBet = context.toCall > 0;
  const multiway = context.activeOpponents >= 2;
  const boardWet = wet(context);
  const lowSpr = context.spr <= 3;

  if (monsters.has(hand.madeHand)) {
    if (facingBet) return weights({ call: lowSpr ? 0.30 : 0.46, raise: lowSpr ? 0.70 : 0.54 });
    return weights(boardWet || multiway
      ? { check: 0.24, "bet-small": 0.30, "bet-medium": 0.46 }
      : { check: 0.32, "bet-small": 0.48, "bet-medium": 0.20 });
  }

  if (hand.madeHand === "two-pair") {
    if (facingBet) return weights({ fold: 0.02, call: 0.63, raise: 0.35 });
    return weights({ check: 0.28, "bet-small": boardWet ? 0.32 : 0.50, "bet-medium": boardWet ? 0.40 : 0.22 });
  }

  const strongPair = hand.madeHand === "pair" &&
    (hand.pairClass === "overpair" || hand.pairClass === "top-pair");
  if (strongPair) {
    if (facingBet) {
      const expensive = context.potOdds > 0.38;
      if (expensive && (boardWet || multiway)) return weights({ fold: 0.30, call: 0.60, raise: 0.10 });
      return weights({ fold: 0.06, call: 0.78, raise: 0.16 });
    }
    return weights(boardWet || multiway
      ? { check: 0.38, "bet-small": 0.36, "bet-medium": 0.26 }
      : { check: 0.36, "bet-small": 0.52, "bet-medium": 0.12 });
  }

  const realFlushDraw = hand.flushDraw && hand.holeCardFlushDraw;
  const realStraightDraw = hand.straightDraw !== null && hand.holeCardStraightDraw;
  const strongDraw = realFlushDraw || (realStraightDraw && hand.straightDraw === "open-ended");
  const comboDraw = realFlushDraw && realStraightDraw;

  if (strongDraw) {
    if (facingBet) {
      const pricedOut = context.potOdds > 0.36;
      if (pricedOut) return weights({ fold: 0.45, call: 0.40, raise: 0.15 });
      return weights(comboDraw && !multiway
        ? { fold: 0.03, call: 0.42, raise: 0.55 }
        : { fold: 0.08, call: 0.68, raise: 0.24 });
    }
    return weights(context.inPosition && !multiway
      ? { check: 0.36, "bet-small": 0.24, "bet-medium": 0.40 }
      : { check: 0.66, "bet-small": 0.18, "bet-medium": 0.16 });
  }

  if (hand.madeHand === "pair") {
    if (facingBet) {
      const cheap = context.potOdds <= 0.22;
      return weights(cheap && !multiway
        ? { fold: 0.30, call: 0.66, raise: 0.04 }
        : { fold: 0.70, call: 0.28, raise: 0.02 });
    }
    return weights({ check: 0.72, "bet-small": 0.24, "bet-medium": 0.04 });
  }

  const gutshot = hand.straightDraw === "gutshot" && hand.holeCardStraightDraw;
  if (gutshot) {
    if (facingBet) {
      return weights(!multiway && context.potOdds <= 0.22
        ? { fold: 0.42, call: 0.48, raise: 0.10 }
        : { fold: 0.78, call: 0.18, raise: 0.04 });
    }
    return weights(context.inPosition && !multiway
      ? { check: 0.48, "bet-small": 0.40, "bet-medium": 0.12 }
      : { check: 0.78, "bet-small": 0.18, "bet-medium": 0.04 });
  }

  const backdoors = Number(hand.backdoorFlushDraw) + Number(hand.backdoorStraightDraw);
  const hasPotential = hand.overcards > 0 || backdoors > 0;

  if (facingBet) {
    if (!hasPotential) return weights({ fold: 0.94, call: 0.05, raise: 0.01 });
    const cheap = context.potOdds <= 0.18;
    const callWeight = cheap ? 0.22 + hand.overcards * 0.08 + backdoors * 0.06 : 0.08;
    const raiseWeight = !multiway && context.inPosition ? 0.08 + backdoors * 0.05 : 0.02;
    return weights({ fold: Math.max(0.50, 1 - callWeight - raiseWeight), call: callWeight, raise: raiseWeight });
  }

  // Missed hands do not automatically surrender. Dry heads-up boards and
  // useful overcard/backdoor equity receive bluff/stab frequency.
  if (!multiway && context.inPosition) {
    const bluff = (boardWet ? 0.18 : 0.34) + hand.overcards * 0.07 + backdoors * 0.06;
    return weights({ check: Math.max(0.20, 1 - bluff), "bet-small": bluff * 0.78, "bet-medium": bluff * 0.22 });
  }

  const probe = hasPotential && !multiway ? 0.20 : 0.06;
  return weights({ check: 1 - probe, "bet-small": probe });
}
