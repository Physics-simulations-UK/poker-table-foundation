import { describe, expect, it } from "vitest";
import { analyzePostflop } from "@/lib/postflop-analysis";
import type { Card, Rank, Suit } from "@/lib/poker";

const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
function cards(text: string): Card[] {
  return text.split(" ").map((token) => ({
    rank: token.slice(0, -1) as Rank,
    suit: suitMap[token.slice(-1)]!,
  }));
}
const hole = (text: string) => cards(text) as [Card, Card];

describe("postflop hand analysis", () => {
  it("recognises top pair rather than just a generic pair", () => {
    const result = analyzePostflop(hole("As 9d"), cards("Ah 7c 2s"));
    expect(result.madeHand).toBe("pair");
    expect(result.pairClass).toBe("top-pair");
    expect(result.usesHoleCard).toBe(true);
  });

  it("recognises an overpair", () => {
    const result = analyzePostflop(hole("Qs Qd"), cards("9h 6c 2s"));
    expect(result.pairClass).toBe("overpair");
  });

  it("recognises a pocket pair below the board", () => {
    const result = analyzePostflop(hole("6s 6d"), cards("Ah 9c 2s"));
    expect(result.pairClass).toBe("pocket-pair-below-board");
  });

  it("recognises two pair and a set through the existing evaluator", () => {
    expect(analyzePostflop(hole("9s 8s"), cards("9h 8c 2d")).madeHand).toBe("two-pair");
    expect(analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s")).madeHand).toBe("three-of-a-kind");
  });

  it("recognises a four-flush draw", () => {
    const result = analyzePostflop(hole("As 5s"), cards("Ks 8s 2d"));
    expect(result.flushDraw).toBe(true);
    expect(result.madeHand).not.toBe("flush");
  });

  it("does not call an already-made flush a flush draw", () => {
    const result = analyzePostflop(hole("As 5s"), cards("Ks 8s 2s"));
    expect(result.madeHand).toBe("flush");
    expect(result.flushDraw).toBe(false);
  });

  it("recognises an open-ended straight draw", () => {
    const result = analyzePostflop(hole("9s 8d"), cards("7c 6h 2s"));
    expect(result.straightDraw).toBe("open-ended");
    expect(result.straightOutRanks).toEqual([5, 10]);
  });

  it("recognises a gutshot", () => {
    const result = analyzePostflop(hole("9s 8d"), cards("6c 5h 2s"));
    expect(result.straightDraw).toBe("gutshot");
    expect(result.straightOutRanks).toEqual([7]);
  });

  it("does not report a draw once a straight is already made", () => {
    const result = analyzePostflop(hole("9s 8d"), cards("7c 6h 5s"));
    expect(result.madeHand).toBe("straight");
    expect(result.straightDraw).toBeNull();
  });

  it("handles wheel gutshots with ace as the completing rank", () => {
    const result = analyzePostflop(hole("5s 4d"), cards("3c 2h 9s"));
    expect(result.straightDraw).toBe("open-ended");
    expect(result.straightOutRanks).toEqual([6, 14]);
  });
});
