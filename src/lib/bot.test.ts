import { describe, expect, it } from "vitest";
import { decideBotAction } from "@/lib/bot";
import { BIG_BLIND } from "@/lib/betting";
import type { Card, GameState, Player, Position } from "@/lib/poker";

const card = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

function player(
  seat: number,
  cards: [Card, Card],
  overrides: Partial<Player> = {},
): Player {
  const positions: Position[] = ["BTN", "SB", "BB", "UTG", "HJ", "CO"];
  return {
    id: `seat-${seat}`,
    name: seat === 0 ? "You" : `Bot ${seat}`,
    stack: 100 * BIG_BLIND,
    position: positions[seat] ?? "UTG",
    cards,
    isHero: seat === 0,
    isDealer: seat === 0,
    folded: false,
    allIn: false,
    streetBet: 0,
    totalCommitted: 0,
    hasActed: false,
    lastAction: null,
    ...overrides,
  };
}

function facingDeepShove(cards: [Card, Card]): GameState {
  const filler: [Card, Card] = [card("5", "clubs"), card("4", "diamonds")];
  const players = [
    player(0, [card("9", "spades"), card("8", "hearts")], {
      stack: 0,
      allIn: true,
      streetBet: 100 * BIG_BLIND,
      totalCommitted: 100 * BIG_BLIND,
      hasActed: true,
      lastAction: "ALL-IN 100BB",
    }),
    player(1, cards),
    player(2, filler, { folded: true }),
    player(3, filler, { folded: true }),
    player(4, filler, { folded: true }),
    player(5, filler, { folded: true }),
  ];

  return {
    players,
    communityCards: [
      card("2", "clubs"),
      card("3", "diamonds"),
      card("6", "hearts"),
      card("7", "spades"),
      card("10", "clubs"),
    ],
    revealedCount: 0,
    dealerSeat: 0,
    handNumber: 1,
    street: "preflop",
    pot: 0,
    currentBet: 100 * BIG_BLIND,
    minRaise: 99 * BIG_BLIND,
    actor: 1,
    winner: null,
    message: null,
  };
}

describe("preflop bot facing a 100BB all-in", () => {
  it.each([
    ["AA", [card("A", "spades"), card("A", "hearts")] as [Card, Card]],
    ["KK", [card("K", "spades"), card("K", "hearts")] as [Card, Card]],
    ["QQ", [card("Q", "spades"), card("Q", "hearts")] as [Card, Card]],
    ["AK suited", [card("A", "spades"), card("K", "spades")] as [Card, Card]],
    ["AK offsuit", [card("A", "spades"), card("K", "hearts")] as [Card, Card]],
  ])("%s calls", (_label, cards) => {
    expect(decideBotAction(facingDeepShove(cards))).toEqual({ type: "call" });
  });

  it.each([
    ["JJ", [card("J", "spades"), card("J", "hearts")] as [Card, Card]],
    ["AQ suited", [card("A", "spades"), card("Q", "spades")] as [Card, Card]],
    ["72 offsuit", [card("7", "clubs"), card("2", "diamonds")] as [Card, Card]],
  ])("%s folds", (_label, cards) => {
    expect(decideBotAction(facingDeepShove(cards))).toEqual({ type: "fold" });
  });
});
