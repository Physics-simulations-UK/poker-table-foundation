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


function facingNormalRaise(cards: [Card, Card], position: Position, raiseBB = 3, openerPosition: Position = "BTN"): GameState {
  const game = facingDeepShove(cards);
  const actor = game.players[1]!;
  const raiser = game.players[0]!;
  return {
    ...game,
    currentBet: raiseBB * BIG_BLIND,
    minRaise: (raiseBB - 1) * BIG_BLIND,
    actor: 1,
    players: game.players.map((p, seat) => {
      if (seat === 0) return {
        ...raiser, position: openerPosition, stack: (100 - raiseBB) * BIG_BLIND, allIn: false,
        streetBet: raiseBB * BIG_BLIND, totalCommitted: raiseBB * BIG_BLIND,
        lastAction: `RAISE TO ${raiseBB}BB`,
      };
      if (seat === 1) return { ...actor, position, stack: 100 * BIG_BLIND, streetBet: 0, totalCommitted: 0 };
      return p;
    }),
  };
}

describe("preflop bot facing a normal open", () => {
  it("defends a small pair from the big blind", () => {
    const hand: [Card, Card] = [card("5", "spades"), card("5", "hearts")];
    expect(decideBotAction(facingNormalRaise(hand, "BB"))).toEqual({ type: "call" });
  });

  it("defends a suited connector on the button", () => {
    const hand: [Card, Card] = [card("9", "spades"), card("8", "spades")];
    expect(decideBotAction(facingNormalRaise(hand, "BTN"))).toEqual({ type: "call" });
  });

  it("defends suited ace from the big blind", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("8", "spades")];
    expect(decideBotAction(facingNormalRaise(hand, "BB"))).toEqual({ type: "call" });
  });

  it("still folds weak offsuit trash from early position", () => {
    const hand: [Card, Card] = [card("7", "clubs"), card("2", "diamonds")];
    expect(decideBotAction(facingNormalRaise(hand, "HJ"))).toEqual({ type: "fold" });
  });
});


describe("v0.4 positional strategy integration", () => {
  it("3-bets AQ from the big blind against a button open", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("Q", "hearts")];
    expect(decideBotAction(facingNormalRaise(hand, "BB", 2.5, "BTN"))).toEqual({
      type: "raise",
      to: 7.5 * BIG_BLIND,
    });
  });

  it("folds A9 offsuit on the button against an UTG open", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("9", "hearts")];
    expect(decideBotAction(facingNormalRaise(hand, "BTN", 3, "UTG"))).toEqual({ type: "fold" });
  });

  it("calls A9 offsuit from the big blind against a button open", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("9", "hearts")];
    expect(decideBotAction(facingNormalRaise(hand, "BB", 2.5, "BTN"))).toEqual({ type: "call" });
  });
});


function facingOpenAndCaller(cards: [Card, Card], position: Position): GameState {
  const game = facingNormalRaise(cards, position, 3, "CO");
  return {
    ...game,
    players: game.players.map((p, seat) => {
      if (seat === 2) return {
        ...p, position: "BTN" as Position, folded: false, allIn: false,
        stack: 97 * BIG_BLIND, streetBet: 3 * BIG_BLIND,
        totalCommitted: 3 * BIG_BLIND, hasActed: true, lastAction: "CALL 3BB",
      };
      return p;
    }),
  };
}

describe("v0.4 complete preflop tree integration", () => {
  it("overcalls a pocket pair after an open and caller", () => {
    const hand: [Card, Card] = [card("6", "spades"), card("6", "hearts")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"))).toEqual({ type: "call" });
  });

  it("overcalls a suited connector after an open and caller", () => {
    const hand: [Card, Card] = [card("9", "spades"), card("8", "spades")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"))).toEqual({ type: "call" });
  });

  it("squeezes a premium hand after an open and caller", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("A", "hearts")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"))).toEqual({
      type: "raise",
      to: 9 * BIG_BLIND,
    });
  });

  it("still folds trash after an open and caller", () => {
    const hand: [Card, Card] = [card("7", "spades"), card("2", "hearts")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"))).toEqual({ type: "fold" });
  });
});
