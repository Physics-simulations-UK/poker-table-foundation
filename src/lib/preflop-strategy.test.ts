import { describe, expect, it } from "vitest";
import { handNotation, shouldOpenRaise } from "@/lib/preflop-strategy";
import type { Card } from "@/lib/poker";

const card = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });
const hand = (a: Card, b: Card): [Card, Card] => [a, b];

describe("preflop hand notation", () => {
  it("normalises card order and suitedness", () => {
    expect(handNotation(hand(card("K", "spades"), card("A", "spades")))).toBe("AKs");
    expect(handNotation(hand(card("Q", "clubs"), card("A", "hearts")))).toBe("AQo");
    expect(handNotation(hand(card("9", "clubs"), card("9", "hearts")))).toBe("99");
  });
});

describe("6-max raise-first-in ranges", () => {
  const A2o = hand(card("A", "spades"), card("2", "hearts"));
  const K8o = hand(card("K", "spades"), card("8", "hearts"));
  const nineEightSuited = hand(card("9", "spades"), card("8", "spades"));
  const pocketFours = hand(card("4", "spades"), card("4", "hearts"));
  const sevenTwo = hand(card("7", "spades"), card("2", "hearts"));

  it("opens substantially tighter UTG than BTN", () => {
    expect(shouldOpenRaise(A2o, "UTG")).toBe(false);
    expect(shouldOpenRaise(A2o, "BTN")).toBe(true);
    expect(shouldOpenRaise(K8o, "UTG")).toBe(false);
    expect(shouldOpenRaise(K8o, "BTN")).toBe(true);
  });

  it("opens useful connected and paired hands by position", () => {
    expect(shouldOpenRaise(nineEightSuited, "UTG")).toBe(true);
    expect(shouldOpenRaise(pocketFours, "UTG")).toBe(false);
    expect(shouldOpenRaise(pocketFours, "HJ")).toBe(true);
  });

  it("still folds genuine trash even on the button", () => {
    expect(shouldOpenRaise(sevenTwo, "BTN")).toBe(false);
  });

  it("does not use an RFI range for the big blind", () => {
    expect(shouldOpenRaise(hand(card("A", "spades"), card("A", "hearts")), "BB")).toBe(false);
  });
});
