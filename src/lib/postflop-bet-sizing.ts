import type { StrategyDistribution } from "@/lib/mixed-strategy";
import type { PostflopAnalysis } from "@/lib/postflop-analysis";
import type { PostflopContext } from "@/lib/postflop-context";

export type BetSize = "small" | "medium" | "large";

function weights(values: StrategyDistribution<BetSize>): StrategyDistribution<BetSize> {
  return values;
}

function wet(context: PostflopContext) {
  return context.board.suitTexture !== "rainbow" || context.board.connectivity !== "disconnected";
}

function strongMade(hand: PostflopAnalysis) {
  return ["straight-flush", "four-of-a-kind", "full-house", "flush", "straight", "three-of-a-kind", "two-pair"].includes(hand.madeHand);
}

function strongDraw(hand: PostflopAnalysis) {
  return (hand.flushDraw && hand.holeCardFlushDraw) ||
    (hand.straightDraw === "open-ended" && hand.holeCardStraightDraw);
}

/**
 * Balanced sizing distribution for voluntary postflop bets.
 *
 * Hand strength influences frequencies, but no ordinary size is reserved for
 * value or bluffs. That makes sizing less directly revealing and leaves room
 * for future solver calibration.
 */
export function postflopBetSizeStrategy(
  hand: PostflopAnalysis,
  context: PostflopContext,
): StrategyDistribution<BetSize> {
  const boardWet = wet(context);
  const multiway = context.activeOpponents >= 2;

  if (strongMade(hand)) {
    if (boardWet || multiway) return weights({ small: 0.22, medium: 0.53, large: 0.25 });
    return weights({ small: 0.48, medium: 0.37, large: 0.15 });
  }

  const strongPair = hand.madeHand === "pair" &&
    (hand.pairClass === "overpair" || hand.pairClass === "top-pair");
  if (strongPair) {
    return boardWet
      ? weights({ small: 0.40, medium: 0.47, large: 0.13 })
      : weights({ small: 0.58, medium: 0.34, large: 0.08 });
  }

  if (strongDraw(hand)) {
    return boardWet
      ? weights({ small: 0.30, medium: 0.48, large: 0.22 })
      : weights({ small: 0.43, medium: 0.42, large: 0.15 });
  }

  // Bluffs use the same size vocabulary as value hands. Useful backdoors can
  // choose medium/large sizes often enough that a large bet is not a tell.
  const backdoors = Number(hand.backdoorFlushDraw) + Number(hand.backdoorStraightDraw);
  if (hand.overcards > 0 || backdoors > 0) {
    return weights({ small: 0.58, medium: 0.32, large: 0.10 });
  }

  return weights({ small: 0.72, medium: 0.23, large: 0.05 });
}

export function potFractionForSize(size: BetSize): number {
  if (size === "small") return 0.33;
  if (size === "medium") return 0.66;
  return 0.90;
}
