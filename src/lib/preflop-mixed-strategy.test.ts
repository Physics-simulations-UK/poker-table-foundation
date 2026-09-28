import { describe, expect, it } from "vitest";
import {
  mixedFirstInStrategy,
  mixedVersusOpenAndCallersStrategy,
  mixedVersusOpenStrategy,
  preflopQuality,
} from "@/lib/preflop-mixed-strategy";
import type { Card, Rank, Suit } from "@/lib/poker";

const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
function hand(text: string): [Card, Card] {
  return text.split(" ").map((token) => ({
    rank: token.slice(0, -1) as Rank,
    suit: suitMap[token.slice(-1)]!,
  })) as [Card, Card];
}
const play = (s: Partial<Record<"fold" | "call" | "raise", number>>) => (s.call ?? 0) + (s.raise ?? 0);

describe("mixed preflop strategy", () => {
  it("scores premiums above marginal and junk holdings", () => {
    expect(preflopQuality(hand("As Ad"))).toBeGreaterThan(preflopQuality(hand("9s 8s")));
    expect(preflopQuality(hand("9s 8s"))).toBeGreaterThan(preflopQuality(hand("7s 2d")));
  });

  it("opens wider from the button than UTG without a hard hand boundary", () => {
    const marginal = hand("8s 6s");
    expect(play(mixedFirstInStrategy(marginal, "BTN"))).toBeGreaterThan(play(mixedFirstInStrategy(marginal, "UTG")));
    expect(mixedFirstInStrategy(marginal, "BTN").fold).toBeGreaterThan(0);
    expect(mixedFirstInStrategy(marginal, "BTN").raise).toBeGreaterThan(0);
  });

  it("still raises premium hands at very high frequency", () => {
    expect(mixedFirstInStrategy(hand("As Ad"), "UTG").raise).toBeGreaterThan(0.9);
  });

  it("defends the big blind wider against a button open than an early open", () => {
    const cards = hand("9s 7s");
    expect(play(mixedVersusOpenStrategy(cards, "BB", "BTN", 2.5)))
      .toBeGreaterThan(play(mixedVersusOpenStrategy(cards, "BB", "UTG", 2.5)));
  });

  it("responds to price rather than treating every raise identically", () => {
    const cards = hand("Ah 9h");
    expect(play(mixedVersusOpenStrategy(cards, "BB", "BTN", 2.0)))
      .toBeGreaterThan(play(mixedVersusOpenStrategy(cards, "BB", "BTN", 4.0)));
  });

  it("gives suited speculative hands more opportunity to overcall multiway", () => {
    const cards = hand("8s 7s");
    const headsUp = mixedVersusOpenStrategy(cards, "BB", "CO", 2.5);
    const multiway = mixedVersusOpenAndCallersStrategy(cards, "BB", "CO", 2.5);
    expect(multiway.call ?? 0).toBeGreaterThan(headsUp.call ?? 0);
  });

  it("does not turn complete junk into an automatic defence", () => {
    const strategy = mixedVersusOpenStrategy(hand("7s 2d"), "HJ", "UTG", 3);
    expect(strategy.fold).toBeGreaterThan(0.8);
  });

  it("keeps multiple actions available around marginal decisions", () => {
    const strategy = mixedVersusOpenStrategy(hand("Ah 10d"), "BB", "BTN", 2.5);
    expect(strategy.fold).toBeGreaterThan(0);
    expect(strategy.call).toBeGreaterThan(0);
    expect(strategy.raise).toBeGreaterThan(0);
  });
});
