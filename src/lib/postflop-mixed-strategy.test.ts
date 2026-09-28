import { describe, expect, it } from "vitest";
import { normalizeStrategy } from "@/lib/mixed-strategy";
import { analyzePostflop } from "@/lib/postflop-analysis";
import { mixedPostflopStrategy } from "@/lib/postflop-mixed-strategy";
import type { PostflopContext } from "@/lib/postflop-context";
import type { Card, Rank, Suit } from "@/lib/poker";

const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
function cards(text: string): Card[] {
  return text.split(" ").map((token) => ({ rank: token.slice(0, -1) as Rank, suit: suitMap[token.slice(-1)]! }));
}
const hole = (text: string) => cards(text) as [Card, Card];

function ctx(overrides: Partial<PostflopContext> = {}): PostflopContext {
  return {
    pot: 100, toCall: 0, potOdds: 0, spr: 6, activeOpponents: 1, inPosition: true,
    board: { pairedness: "unpaired", connectivity: "disconnected", suitTexture: "rainbow", highCard: 14 },
    ...overrides,
  };
}

describe("mixed postflop strategy", () => {
  it("mixes value bet sizes with a set rather than using one fixed action", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx()));
    expect(strategy.check).toBeGreaterThan(0);
    expect(strategy["bet-small"]).toBeGreaterThan(0);
    expect(strategy["bet-medium"]).toBeGreaterThan(0);
  });

  it("mostly continues top pair at an ordinary price but retains alternatives", () => {
    const hand = analyzePostflop(hole("As 9d"), cards("Ah 7c 2s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 30, potOdds: 0.23 })));
    expect(strategy.call).toBeGreaterThan(strategy.fold);
    expect(strategy.raise).toBeGreaterThan(0);
    expect(strategy.fold).toBeGreaterThan(0);
  });

  it("gives a genuine combo draw meaningful semi-bluff frequency", () => {
    const hand = analyzePostflop(hole("9s 8s"), cards("7s 6h 2s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 30, potOdds: 0.23 })));
    expect(strategy.raise).toBeGreaterThan(0.3);
    expect(strategy.call).toBeGreaterThan(0);
  });

  it("does not mistake a board-only four-flush for a player's flush draw", () => {
    const hand = analyzePostflop(hole("Ah 5d"), cards("Ks 8s 2s 3s"));
    expect(hand.flushDraw).toBe(true);
    expect(hand.holeCardFlushDraw).toBe(false);
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 30, potOdds: 0.23 })));
    expect(strategy.fold).toBeGreaterThan(strategy.raise);
  });

  it("continues two overcards with useful potential more than complete air", () => {
    const useful = analyzePostflop(hole("As Kd"), cards("Qh 7c 2s"));
    const air = analyzePostflop(hole("8h 3d"), cards("Qh 7c 2s"));
    const situation = ctx({ toCall: 15, potOdds: 0.13 });
    const usefulStrategy = normalizeStrategy(mixedPostflopStrategy(useful, situation));
    const airStrategy = normalizeStrategy(mixedPostflopStrategy(air, situation));
    expect(usefulStrategy.call).toBeGreaterThan(airStrategy.call);
  });

  it("bluffs useful air more often heads-up in position than multiway", () => {
    const hand = analyzePostflop(hole("As Kd"), cards("Qh 7c 2s"));
    const headsUp = normalizeStrategy(mixedPostflopStrategy(hand, ctx()));
    const multiway = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ activeOpponents: 3 })));
    expect((headsUp["bet-small"] ?? 0) + (headsUp["bet-medium"] ?? 0))
      .toBeGreaterThan((multiway["bet-small"] ?? 0) + (multiway["bet-medium"] ?? 0));
  });

  it("makes weak-pair calls sensitive to the price", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Qh 9c 2s"));
    const cheap = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 15, potOdds: 0.13 })));
    const expensive = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 60, potOdds: 0.38 })));
    expect(cheap.call).toBeGreaterThan(expensive.call);
  });
});
