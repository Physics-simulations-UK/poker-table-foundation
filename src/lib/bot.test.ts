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
    expect(decideBotAction(facingNormalRaise(hand, "BB"), 0.5)).toEqual({ type: "call" });
  });

  it("defends a suited connector on the button", () => {
    const hand: [Card, Card] = [card("9", "spades"), card("8", "spades")];
    expect(decideBotAction(facingNormalRaise(hand, "BTN"), 0.5)).toEqual({ type: "call" });
  });

  it("defends suited ace from the big blind", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("8", "spades")];
    expect(decideBotAction(facingNormalRaise(hand, "BB"), 0.5)).toEqual({ type: "call" });
  });

  it("still folds weak offsuit trash from early position", () => {
    const hand: [Card, Card] = [card("7", "clubs"), card("2", "diamonds")];
    expect(decideBotAction(facingNormalRaise(hand, "HJ"), 0.5)).toEqual({ type: "fold" });
  });
});

describe("v0.4 positional strategy integration", () => {
  it("can 3-bet AQ from the big blind against a button open", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("Q", "hearts")];
    expect(decideBotAction(facingNormalRaise(hand, "BB", 2.5, "BTN"), 0.99)).toEqual({
      type: "raise",
      to: 7.5 * BIG_BLIND,
    });
  });

  it("folds A9 offsuit on the button against an UTG open at a folding roll", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("9", "hearts")];
    expect(decideBotAction(facingNormalRaise(hand, "BTN", 3, "UTG"), 0.01)).toEqual({ type: "fold" });
  });

  it("can call A9 offsuit from the big blind against a button open", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("9", "hearts")];
    expect(decideBotAction(facingNormalRaise(hand, "BB", 2.5, "BTN"), 0.5)).toEqual({ type: "call" });
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
  it("can overcall a pocket pair after an open and caller", () => {
    const hand: [Card, Card] = [card("6", "spades"), card("6", "hearts")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"), 0.5)).toEqual({ type: "call" });
  });

  it("can overcall a suited connector after an open and caller", () => {
    const hand: [Card, Card] = [card("9", "spades"), card("8", "spades")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"), 0.5)).toEqual({ type: "call" });
  });

  it("can squeeze a premium hand after an open and caller", () => {
    const hand: [Card, Card] = [card("A", "spades"), card("A", "hearts")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"), 0.99)).toEqual({
      type: "raise",
      to: 9 * BIG_BLIND,
    });
  });

  it("still folds trash after an open and caller", () => {
    const hand: [Card, Card] = [card("7", "spades"), card("2", "hearts")];
    expect(decideBotAction(facingOpenAndCaller(hand, "BB"), 0.01)).toEqual({ type: "fold" });
  });
});

function postflopGame(
  botCards: [Card, Card],
  board: Card[],
  options: { currentBet?: number; botStreetBet?: number; pot?: number } = {},
): GameState {
  const filler: [Card, Card] = [card("K", "clubs"), card("4", "diamonds")];
  const currentBet = options.currentBet ?? 0;
  const botStreetBet = options.botStreetBet ?? 0;
  return {
    players: [
      player(0, filler, {
        position: "BTN", stack: 90 * BIG_BLIND, streetBet: currentBet,
        totalCommitted: currentBet, hasActed: currentBet > 0,
        lastAction: currentBet > 0 ? `RAISE TO ${currentBet / BIG_BLIND}BB` : "CHECK",
      }),
      player(1, botCards, {
        position: "BB", stack: 90 * BIG_BLIND, streetBet: botStreetBet,
        totalCommitted: botStreetBet, hasActed: false,
      }),
      player(2, filler, { folded: true }),
      player(3, filler, { folded: true }),
      player(4, filler, { folded: true }),
      player(5, filler, { folded: true }),
    ],
    communityCards: [...board, ...Array(Math.max(0, 5 - board.length)).fill(card("2", "clubs"))].slice(0, 5),
    revealedCount: board.length as 3 | 4 | 5,
    dealerSeat: 0,
    handNumber: 1,
    street: board.length === 3 ? "flop" : board.length === 4 ? "turn" : "river",
    pot: options.pot ?? 100,
    currentBet,
    minRaise: BIG_BLIND,
    actor: 1,
    winner: null,
    message: null,
  };
}

describe("v0.4 live balanced bet sizing", () => {
  it("can use a small size with a strong made hand", () => {
    const game = postflopGame(
      [card("9", "spades"), card("8", "spades")],
      [card("9", "hearts"), card("8", "clubs"), card("2", "diamonds")],
      { pot: 90 },
    );
    expect(decideBotAction(game, 0.5, 0.1)).toEqual({ type: "raise", to: 30 });
  });

  it("can use a medium size with the same strong made hand", () => {
    const game = postflopGame(
      [card("9", "spades"), card("8", "spades")],
      [card("9", "hearts"), card("8", "clubs"), card("2", "diamonds")],
      { pot: 90 },
    );
    expect(decideBotAction(game, 0.5, 0.7)).toEqual({ type: "raise", to: 59 });
  });

  it("can use a large size with the same strong made hand", () => {
    const game = postflopGame(
      [card("9", "spades"), card("8", "spades")],
      [card("9", "hearts"), card("8", "clubs"), card("2", "diamonds")],
      { pot: 90 },
    );
    expect(decideBotAction(game, 0.5, 0.95)).toEqual({ type: "raise", to: 81 });
  });
});

describe("v0.4 mixed postflop bot integration", () => {
  it("can raise a flopped set when facing a bet", () => {
    const game = postflopGame(
      [card("6", "spades"), card("6", "diamonds")],
      [card("A", "hearts"), card("6", "clubs"), card("3", "spades")],
      { currentBet: 30, pot: 100 },
    );
    expect(decideBotAction(game, 0.9)).toEqual({ type: "raise", to: 90 });
  });

  it("can value bet flopped two pair when checked to", () => {
    const game = postflopGame(
      [card("9", "spades"), card("8", "spades")],
      [card("9", "hearts"), card("8", "clubs"), card("2", "diamonds")],
      { pot: 90 },
    );
    expect(decideBotAction(game, 0.5).type).toBe("raise");
  });

  it("can call with top pair at an ordinary price", () => {
    const game = postflopGame(
      [card("A", "spades"), card("9", "diamonds")],
      [card("A", "hearts"), card("7", "clubs"), card("2", "spades")],
      { currentBet: 30, pot: 100 },
    );
    expect(decideBotAction(game, 0.5)).toEqual({ type: "call" });
  });

  it("can continue with a flush draw instead of folding mechanically", () => {
    const game = postflopGame(
      [card("A", "spades"), card("5", "spades")],
      [card("K", "spades"), card("8", "spades"), card("2", "diamonds")],
      { currentBet: 30, pot: 100 },
    );
    expect(decideBotAction(game, 0.5)).toEqual({ type: "call" });
  });

  it("usually folds missed AK to meaningful pressure", () => {
    const game = postflopGame(
      [card("A", "spades"), card("K", "diamonds")],
      [card("9", "hearts"), card("7", "clubs"), card("2", "spades")],
      { currentBet: 50, pot: 100 },
    );
    expect(decideBotAction(game, 0.2)).toEqual({ type: "fold" });
  });

  it("can slow-play a strong made hand by checking", () => {
    const game = postflopGame(
      [card("6", "spades"), card("6", "diamonds")],
      [card("A", "hearts"), card("6", "clubs"), card("3", "spades")],
      { pot: 100 },
    );
    expect(decideBotAction(game, 0.1)).toEqual({ type: "check" });
  });

  it("can continue useful overcards against a cheap bet", () => {
    const game = postflopGame(
      [card("A", "spades"), card("K", "diamonds")],
      [card("Q", "hearts"), card("7", "clubs"), card("2", "spades")],
      { currentBet: 15, pot: 100 },
    );
    expect(decideBotAction(game, 0.7)).toEqual({ type: "call" });
  });
});
