import { calculatePotOdds, analyzeBoardTexture } from "@/lib/postflop-context";
import { analyzePostflop } from "@/lib/postflop-analysis";
import type { HeroDecisionSnapshot } from "@/lib/hero-decision";

export interface FlopDecisionExplanation {
  handStrength: string;
  boardTexture: string;
  potOddsPercent: number | null;
  note: string;
  handExplanation: string;
  boardExplanation: string;
  recommendedAction: "call" | "check" | "fold" | "bet" | "uncertain";
  recommendationReason: string;
}

/** Descriptive flop coaching only; does not claim a play is GTO-correct. */
export function explainFlopDecision(decision: HeroDecisionSnapshot): FlopDecisionExplanation | null {
  if (decision.street !== "flop" || decision.board.length !== 3) return null;
  const hand = analyzePostflop(decision.holeCards, decision.board);
  const board = analyzeBoardTexture(decision.board);
  const strength = hand.madeHand === "pair" && hand.pairClass
    ? hand.pairClass.replaceAll("-", " ")
    : hand.madeHand.replaceAll("-", " ");
  const draws = [
    hand.flushDraw && hand.holeCardFlushDraw ? "flush draw" : null,
    hand.straightDraw && hand.holeCardStraightDraw ? hand.straightDraw + " straight draw" : null,
  ].filter(Boolean);
  const handStrength = [strength, ...draws].join(" + ");
  const boardTexture = [board.suitTexture, board.connectivity, board.pairedness].join(" · ");
  const potOddsPercent = decision.toCall > 0
    ? Math.round(calculatePotOdds(decision.potBefore, decision.toCall) * 1000) / 10
    : null;
  const note = decision.toCall > 0
    ? "This is the break-even equity threshold for a call based on immediate pot odds, not an assessment of your actual equity."
    : "No bet to call. Pot odds do not determine whether a check or bet is preferable.";
  const handExplanation = hand.madeHand === "pair"
    ? hand.pairClass === "top-pair" ? "You have top pair: one of your cards matches the highest card on the flop."
    : hand.pairClass === "overpair" ? "Your pocket pair is higher than every card on the flop."
    : "You have one pair. Consider how it compares with the highest card on the flop."
    : hand.madeHand === "high-card" ? "You have not made a pair or stronger hand yet."
    : "You have " + hand.madeHand.replaceAll("-", " ") + ".";
  const drawExplanation = draws.length ? " You also have a " + draws.join(" and ") + "." : "";
  const boardExplanation = board.suitTexture === "two-tone"
    ? "Two flop cards share a suit, so a flush draw may be possible."
    : board.suitTexture === "monotone"
    ? "All three flop cards share a suit. Flushes and flush draws are important threats."
    : "All three flop cards have different suits, so no immediate flush draw is possible.";
  const strongMadeHand = !["high-card", "pair"].includes(hand.madeHand);
  const strongPair = hand.madeHand === "pair" && ["top-pair", "overpair"].includes(hand.pairClass ?? "");
  const realDraw = (hand.flushDraw && hand.holeCardFlushDraw) ||
    (hand.straightDraw !== null && hand.holeCardStraightDraw);
  let recommendedAction: FlopDecisionExplanation["recommendedAction"] = "uncertain";
  let recommendationReason = "The best action depends on your opponent's range, their bet size and the betting history. Hand strength alone is not enough to give reliable advice.";
  if (decision.toCall > 0) {
    if (strongMadeHand || strongPair) {
      recommendedAction = "call";
      recommendationReason = "You have a reasonably strong made hand. Calling is a sensible starting point, keeping weaker hands in the pot. Raising may also be appropriate against some opponents.";
    } else if (hand.madeHand === "high-card" && !realDraw && potOddsPercent !== null && potOddsPercent >= 30) {
      recommendedAction = "fold";
      recommendationReason = "You have no pair or strong immediate draw, and this call needs substantial equity. Folding is usually the safer default.";
    } else if (realDraw && potOddsPercent !== null && potOddsPercent <= 20) {
      recommendedAction = "call";
      recommendationReason = "You have a meaningful draw and the call is relatively inexpensive. Calling is a reasonable starting point, although your actual equity is not yet calculated.";
    }
  } else if (strongMadeHand || strongPair) {
    recommendedAction = "bet";
    recommendationReason = "You have a strong made hand, so betting for value is often reasonable. Checking can still be correct depending on position and earlier actions.";
  } else {
    recommendedAction = "check";
    recommendationReason = "Checking avoids committing chips with a hand that may not be strong enough to value bet. Bluffing can still be correct in some situations.";
  }
  return { handStrength, boardTexture, potOddsPercent, note, handExplanation: handExplanation + drawExplanation, boardExplanation, recommendedAction, recommendationReason };
}
