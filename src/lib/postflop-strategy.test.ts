import { describe, expect, it } from "vitest";
import { analyzePostflop } from "@/lib/postflop-analysis";
import { analyzeBoardTexture, type PostflopContext } from "@/lib/postflop-context";
import { decidePostflop } from "@/lib/postflop-strategy";
import type { Card, Rank, Suit } from "@/lib/poker";

const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
function cards(text: string): Card[] {
  return text.split(" ").map((token) => ({
    rank: token.slice(0, -1) as Rank,
    suit: suitMap[token.slice(-1)]!,
  }));
}
const hole = (text: string) => cards(text) as [Card, Card];

function context(boardText: string, overrides: Partial<PostflopContext> = {}): PostflopContext {
  const board = cards(boardText);
  return {
    pot: 100,
    toCall: 0,
    potOdds: 0,
    spr: 6,
    activeOpponents: 1,
    inPosition: true,
    board: analyzeBoardTexture(board),
    ...overrides,
  };
}

describe("postflop strategic decisions", () => {
  it("raises a set when facing a bet", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s"));
    expect(decidePostflop(hand, context("Ah 6c 3s", { toCall: 50, potOdds: 1 / 3 }))).toBe("raise");
  });

  it("value bets two pair rather than checking it away", () => {
    const hand = analyzePostflop(hole("9s 8s"), cards("9h 8c 2d"));
    expect(decidePostflop(hand, context("9h 8c 2d"))).toBe("bet-small");
  });

  it("continues with top pair at an ordinary price", () => {
    const hand = analyzePostflop(hole("As 9d"), cards("Ah 7c 2s"));
    expect(decidePostflop(hand, context("Ah 7c 2s", { toCall: 50, potOdds: 1 / 3 }))).toBe("call");
  });

  it("can fold one pair to an expensive bet on a wet multiway board", () => {
    const hand = analyzePostflop(hole("As 10d"), cards("10s 9s 8c"));
    expect(decidePostflop(hand, context("10s 9s 8c", {
      toCall: 100, potOdds: 0.5, activeOpponents: 2, inPosition: false,
    }))).toBe("fold");
  });

  it("continues with a flush draw at a reasonable price", () => {
    const hand = analyzePostflop(hole("As 5s"), cards("Ks 8s 2d"));
    expect(decidePostflop(hand, context("Ks 8s 2d", { toCall: 30, potOdds: 0.23 }))).toBe("call");
  });

  it("continues with an open-ended straight draw at a reasonable price", () => {
    const hand = analyzePostflop(hole("9s 8d"), cards("7c 6h 2s"));
    expect(decidePostflop(hand, context("7c 6h 2s", { toCall: 40, potOdds: 0.286 }))).toBe("call");
  });

  it("semi-bluff raises a heads-up combo draw", () => {
    const hand = analyzePostflop(hole("9s 8s"), cards("7s 6h 2s"));
    expect(decidePostflop(hand, context("7s 6h 2s", { toCall: 40, potOdds: 0.286 }))).toBe("raise");
  });

  it("folds air to a bet instead of using preflop card strength", () => {
    const hand = analyzePostflop(hole("As Kd"), cards("9h 7c 2s"));
    expect(decidePostflop(hand, context("9h 7c 2s", { toCall: 50, potOdds: 1 / 3 }))).toBe("fold");
  });

  it("checks weak showdown value when not facing a bet", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Ah 9c 2s"));
    expect(decidePostflop(hand, context("Ah 9c 2s", { inPosition: false }))).toBe("check");
  });

  it("allows a restrained heads-up positional stab with air on a dry board", () => {
    const hand = analyzePostflop(hole("Kc Qd"), cards("8h 4c 2s"));
    expect(decidePostflop(hand, context("8h 4c 2s"))).toBe("bet-small");
  });
});
