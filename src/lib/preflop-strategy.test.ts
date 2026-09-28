import { describe, expect, it } from "vitest";
import { actionVersusOpen, handNotation, shouldOpenRaise } from "@/lib/preflop-strategy";
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


describe("position-aware response to one open raise", () => {
  const cards = (a: Card["rank"], b: Card["rank"], suited = false): [Card, Card] =>
    hand(card(a, "spades"), card(b, suited ? "spades" : "hearts"));

  it("3-bets premium hands against any opener", () => {
    expect(actionVersusOpen(cards("A", "A"), "BTN", "UTG")).toBe("3bet");
    expect(actionVersusOpen(cards("A", "K", true), "BB", "UTG")).toBe("3bet");
  });

  it("respects an early-position open", () => {
    expect(actionVersusOpen(cards("A", "10", true), "BTN", "UTG")).toBe("call");
    expect(actionVersusOpen(cards("A", "9"), "BTN", "UTG")).toBe("fold");
    expect(actionVersusOpen(cards("5", "5"), "CO", "UTG")).toBe("fold");
  });

  it("widens against a late-position open", () => {
    expect(actionVersusOpen(cards("5", "5"), "BTN", "CO")).toBe("call");
    expect(actionVersusOpen(cards("A", "10"), "BTN", "CO")).toBe("call");
  });

  it("3-bets more hands against a steal", () => {
    expect(actionVersusOpen(cards("A", "Q"), "BB", "BTN")).toBe("3bet");
    expect(actionVersusOpen(cards("A", "5", true), "BB", "BTN")).toBe("3bet");
  });

  it("defends the big blind wider than other seats", () => {
    expect(actionVersusOpen(cards("9", "7", true), "BB", "BTN")).toBe("call");
    expect(actionVersusOpen(cards("9", "7", true), "HJ", "BTN")).toBe("fold");
  });

  it("still folds trash in the big blind", () => {
    expect(actionVersusOpen(cards("7", "2"), "BB", "BTN")).toBe("fold");
  });
});
