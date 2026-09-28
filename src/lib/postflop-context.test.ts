import { describe, expect, it } from "vitest";
import { analyzeBoardTexture, calculatePotOdds, calculateSPR } from "@/lib/postflop-context";
import type { Card, Rank, Suit } from "@/lib/poker";

const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
function cards(text: string): Card[] {
  return text.split(" ").map((token) => ({
    rank: token.slice(0, -1) as Rank,
    suit: suitMap[token.slice(-1)]!,
  }));
}

describe("postflop maths", () => {
  it("calculates pot odds for common bet sizes", () => {
    expect(calculatePotOdds(100, 50)).toBeCloseTo(1 / 3);
    expect(calculatePotOdds(100, 100)).toBeCloseTo(0.5);
    expect(calculatePotOdds(100, 0)).toBe(0);
  });

  it("calculates effective stack-to-pot ratio", () => {
    expect(calculateSPR(800, [600], 200)).toBe(3);
    expect(calculateSPR(500, [900], 100)).toBe(5);
  });
});

describe("board texture", () => {
  it("recognises a dry rainbow disconnected flop", () => {
    const texture = analyzeBoardTexture(cards("As 7d 2c"));
    expect(texture.suitTexture).toBe("rainbow");
    expect(texture.connectivity).toBe("disconnected");
    expect(texture.pairedness).toBe("unpaired");
  });

  it("recognises a wet two-tone connected flop", () => {
    const texture = analyzeBoardTexture(cards("9s 8s 7d"));
    expect(texture.suitTexture).toBe("two-tone");
    expect(texture.connectivity).toBe("connected");
  });

  it("recognises four-card highly connected boards", () => {
    expect(analyzeBoardTexture(cards("10s 9h 8d 7c")).connectivity).toBe("highly-connected");
  });

  it("recognises monotone and paired boards", () => {
    const texture = analyzeBoardTexture(cards("Ks 8s 8s"));
    expect(texture.suitTexture).toBe("monotone");
    expect(texture.pairedness).toBe("paired");
  });

  it("recognises double-paired and trips boards", () => {
    expect(analyzeBoardTexture(cards("Ks Kd 8s 8h 2c")).pairedness).toBe("double-paired");
    expect(analyzeBoardTexture(cards("Ks Kd Kh 8s 2c")).pairedness).toBe("trips");
  });

  it("handles wheel connectivity with ace low", () => {
    expect(analyzeBoardTexture(cards("As 2d 3c 4h")).connectivity).toBe("highly-connected");
  });
});
