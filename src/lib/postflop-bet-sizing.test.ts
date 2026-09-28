import { describe, expect, it } from "vitest";
import { normalizeStrategy } from "@/lib/mixed-strategy";
import { analyzePostflop } from "@/lib/postflop-analysis";
import { postflopBetSizeStrategy, potFractionForSize } from "@/lib/postflop-bet-sizing";
import type { PostflopContext } from "@/lib/postflop-context";
import type { Card, Rank, Suit } from "@/lib/poker";

const suits: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
const cards = (text: string): Card[] => text.split(" ").map((x) => ({ rank: x.slice(0, -1) as Rank, suit: suits[x.slice(-1)]! }));
const hole = (text: string) => cards(text) as [Card, Card];
const ctx = (overrides: Partial<PostflopContext> = {}): PostflopContext => ({
  pot: 100, toCall: 0, potOdds: 0, spr: 6, activeOpponents: 1, inPosition: true,
  board: { pairedness: "unpaired", connectivity: "disconnected", suitTexture: "rainbow", highCard: 14 },
  ...overrides,
});

describe("balanced postflop bet sizing", () => {
  it("allows strong made hands to use every ordinary size", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s"));
    const s = normalizeStrategy(postflopBetSizeStrategy(hand, ctx()));
    expect(s.small).toBeGreaterThan(0);
    expect(s.medium).toBeGreaterThan(0);
    expect(s.large).toBeGreaterThan(0);
  });

  it("allows draws to share medium and large sizes with value", () => {
    const hand = analyzePostflop(hole("9s 8s"), cards("7s 6h 2s"));
    const s = normalizeStrategy(postflopBetSizeStrategy(hand, ctx()));
    expect(s.medium).toBeGreaterThan(0.3);
    expect(s.large).toBeGreaterThan(0.1);
  });

  it("allows useful bluffs to use more than the small size", () => {
    const hand = analyzePostflop(hole("As Kd"), cards("Qh 7c 2s"));
    const s = normalizeStrategy(postflopBetSizeStrategy(hand, ctx()));
    expect(s.medium).toBeGreaterThan(0);
    expect(s.large).toBeGreaterThan(0);
  });

  it("shifts strong hands toward larger sizing on wet boards", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("9s 6c 5s"));
    const dry = normalizeStrategy(postflopBetSizeStrategy(hand, ctx()));
    const wet = normalizeStrategy(postflopBetSizeStrategy(hand, ctx({
      board: { pairedness: "unpaired", connectivity: "connected", suitTexture: "two-tone", highCard: 9 },
    })));
    expect((wet.medium ?? 0) + (wet.large ?? 0)).toBeGreaterThan((dry.medium ?? 0) + (dry.large ?? 0));
  });

  it("maps size labels to stable pot fractions", () => {
    expect(potFractionForSize("small")).toBe(0.33);
    expect(potFractionForSize("medium")).toBe(0.66);
    expect(potFractionForSize("large")).toBe(0.9);
  });
});
