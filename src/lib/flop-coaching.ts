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
  return { handStrength, boardTexture, potOddsPercent, note, handExplanation: handExplanation + drawExplanation, boardExplanation };
}
