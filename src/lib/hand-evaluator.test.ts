import { describe, expect, it } from "vitest";
import { compareHands, evaluateHand } from "@/lib/hand-evaluator";
import type { Card, Rank, Suit } from "@/lib/poker";

const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };

function cards(text: string): Card[] {
  return text.split(" ").map((token) => {
    const suit = suitMap[token.slice(-1)];
    const rank = token.slice(0, -1) as Rank;
    if (!suit) throw new Error(`Invalid card: ${token}`);
    return { rank, suit };
  });
}

describe("seven-card hand evaluator", () => {
  it.each([
    ["A-high", "As Kd Qc Jh 9s 4d 2c", "high-card"],
    ["one pair", "As Ad Kc Qh 9s 4d 2c", "pair"],
    ["two pair", "As Ad Kc Kh 9s 4d 2c", "two-pair"],
    ["trips", "As Ad Ac Kh 9s 4d 2c", "three-of-a-kind"],
    ["straight", "9s 8d 7c 6h 5s Ad 2c", "straight"],
    ["flush", "As Js 9s 5s 2s Kd Qc", "flush"],
    ["full house", "As Ad Ac Kh Ks 4d 2c", "full-house"],
    ["quads", "As Ad Ac Ah Ks 4d 2c", "four-of-a-kind"],
    ["straight flush", "9s 8s 7s 6s 5s Ad Kc", "straight-flush"],
  ])("recognises %s", (_label, input, expected) => {
    expect(evaluateHand(cards(input)).category).toBe(expected);
  });

  it("recognises the ace-low wheel straight", () => {
    const value = evaluateHand(cards("As 2d 3c 4h 5s Kd Qc"));
    expect(value.category).toBe("straight");
    expect(value.tiebreakers).toEqual([5]);
  });

  it("chooses the best five cards from seven", () => {
    const value = evaluateHand(cards("As Ad Kc Kh Ks 4d 2c"));
    expect(value.category).toBe("full-house");
    expect(value.tiebreakers).toEqual([13, 14]);
  });

  it("uses kickers to break a pair tie", () => {
    const board = cards("Ah 7d 4c 3s 2h");
    const aceKing = [...cards("Ad Kc"), ...board];
    const aceQueen = [...cards("Ac Qc"), ...board];
    expect(compareHands(aceKing, aceQueen)).toBeGreaterThan(0);
  });

  it("compares two-pair using the lower pair before the kicker", () => {
    expect(compareHands(cards("As Ad Kc Kh 9s 4d 2c"), cards("As Ad Qc Qh Ks 4d 2c"))).toBeGreaterThan(0);
  });

  it("compares full houses by trips first", () => {
    expect(compareHands(cards("Ks Kd Kc Ah As 4d 2c"), cards("Qs Qd Qc Ah As Kd 2c"))).toBeGreaterThan(0);
  });

  it("returns a tie when the board is the best hand for both players", () => {
    const board = cards("As Kd Qc Jh 10s");
    expect(compareHands([...cards("2c 3c"), ...board], [...cards("4d 5d"), ...board])).toBe(0);
  });

  it("rejects fewer than five or more than seven cards", () => {
    expect(() => evaluateHand(cards("As Kd Qc Jh"))).toThrow();
    expect(() => evaluateHand(cards("As Kd Qc Jh 10s 9d 8c 7h"))).toThrow();
  });
});
