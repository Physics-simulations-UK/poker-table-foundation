import { describe, expect, it } from "vitest";
import { resolveShowdown } from "@/lib/showdown";
import { createHand, type Card, type GameState, type Rank, type Suit } from "@/lib/poker";

const suits: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
function card(token: string): Card {
  const suit = suits[token.slice(-1)];
  if (!suit) throw new Error("Bad card");
  return { rank: token.slice(0, -1) as Rank, suit };
}
function cards(text: string): Card[] { return text.split(" ").map(card); }

function showdownGame(): GameState {
  const game = createHand(4, 1);
  return {
    ...game,
    street: "complete",
    revealedCount: 5,
    actor: null,
    pot: 100,
    communityCards: cards("Ah 7d 4c 3s 2h") as GameState["communityCards"],
    players: game.players.map((p, seat) => ({
      ...p,
      folded: seat > 1,
      streetBet: 0,
      // This fixture supplies game.pot directly, so clear the blind
      // contributions inherited from createHand().
      totalCommitted: 0,
      cards: (seat === 0 ? cards("Ad Kc") : seat === 1 ? cards("Ac Qc") : p.cards) as [Card, Card],
    })),
  };
}

describe("showdown resolution", () => {
  it("awards the whole pot to the strongest live hand", () => {
    const game = showdownGame();
    const heroBefore = game.players[0]!.stack;
    const villainBefore = game.players[1]!.stack;
    const result = resolveShowdown(game);

    expect(result.winners).toEqual([0]);
    expect(result.game.players[0]!.stack).toBe(heroBefore + 100);
    expect(result.game.players[1]!.stack).toBe(villainBefore);
    expect(result.game.pot).toBe(0);
    expect(result.game.message).toContain("HERO WINS 10BB");
    expect(result.game.message).toContain("PAIR");
  });

  it("ignores a stronger folded hand", () => {
    const game = showdownGame();
    game.players[2] = {
      ...game.players[2]!,
      folded: true,
      cards: cards("5s 6s") as [Card, Card],
    };
    expect(resolveShowdown(game).winners).toEqual([0]);
  });

  it("splits a tied pot evenly", () => {
    const game = showdownGame();
    game.communityCards = cards("As Kd Qc Jh 10s") as GameState["communityCards"];
    game.players[0] = { ...game.players[0]!, cards: cards("2c 3c") as [Card, Card] };
    game.players[1] = { ...game.players[1]!, cards: cards("4d 5d") as [Card, Card] };
    const heroBefore = game.players[0]!.stack;
    const villainBefore = game.players[1]!.stack;

    const result = resolveShowdown(game);
    expect(result.winners).toEqual([0, 1]);
    expect(result.game.players[0]!.stack).toBe(heroBefore + 50);
    expect(result.game.players[1]!.stack).toBe(villainBefore + 50);
    expect(result.game.message).toContain("SPLIT 10BB");
  });

  it("preserves every chip when an odd chip must be split", () => {
    const game = showdownGame();
    game.pot = 101;
    game.communityCards = cards("As Kd Qc Jh 10s") as GameState["communityCards"];
    game.players[0] = { ...game.players[0]!, cards: cards("2c 3c") as [Card, Card] };
    game.players[1] = { ...game.players[1]!, cards: cards("4d 5d") as [Card, Card] };
    const before = game.players.reduce((sum, p) => sum + p.stack, 0) + game.pot;

    const result = resolveShowdown(game);
    const after = result.game.players.reduce((sum, p) => sum + p.stack, 0) + result.game.pot;
    expect(after).toBe(before);
    expect(result.game.players[0]!.stack + result.game.players[1]!.stack)
      .toBe(game.players[0]!.stack + game.players[1]!.stack + 101);
  });

  it("rejects showdown before the river is fully revealed", () => {
    const game = { ...showdownGame(), revealedCount: 4 as const };
    expect(() => resolveShowdown(game)).toThrow("all five community cards");
  });

  it("awards a short-stack winner only the main pot and a deeper player the side pot", () => {
    const game = showdownGame();
    game.pot = 0;
    game.communityCards = cards("2c 7d 9h Js Kc") as GameState["communityCards"];
    game.players = game.players.map((p, seat) => ({
      ...p,
      folded: seat > 2,
      streetBet: 0,
      totalCommitted: seat === 0 ? 200 : seat <= 2 ? 500 : 0,
      stack: seat === 0 ? 0 : seat <= 2 ? 500 : p.stack,
      allIn: seat <= 2,
    }));
    game.players[0] = { ...game.players[0]!, cards: cards("As Ad") as [Card, Card] };
    game.players[1] = { ...game.players[1]!, cards: cards("Qs Qd") as [Card, Card] };
    game.players[2] = { ...game.players[2]!, cards: cards("10s 10d") as [Card, Card] };
    const stacks = game.players.map((p) => p.stack);

    const result = resolveShowdown(game);

    // Main pot: 20BB x 3 = 60BB to seat 0 (AA).
    expect(result.game.players[0]!.stack).toBe(stacks[0]! + 600);
    // Side pot: remaining 30BB x 2 = 60BB to seat 1 (QQ).
    expect(result.game.players[1]!.stack).toBe(stacks[1]! + 600);
    expect(result.game.players[2]!.stack).toBe(stacks[2]);
    expect(result.winners).toEqual(expect.arrayContaining([0, 1]));
  });

  it("includes folded chips in pots but never lets a folded player win", () => {
    const game = showdownGame();
    game.pot = 0;
    game.players = game.players.map((p, seat) => ({
      ...p,
      folded: seat === 2 || seat > 2,
      totalCommitted: seat <= 2 ? 200 : 0,
      streetBet: 0,
    }));
    game.players[0] = { ...game.players[0]!, cards: cards("Ks Kd") as [Card, Card] };
    game.players[1] = { ...game.players[1]!, cards: cards("Qs Qd") as [Card, Card] };
    game.players[2] = { ...game.players[2]!, cards: cards("As Ad") as [Card, Card], folded: true };
    const before = game.players[0]!.stack;

    const result = resolveShowdown(game);
    expect(result.winners).toEqual([0]);
    expect(result.game.players[0]!.stack).toBe(before + 600);
  });

});
