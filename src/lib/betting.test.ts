import { describe, expect, it } from "vitest";
import { applyAction, potTotal } from "@/lib/betting";
import { createHand, type GameState } from "@/lib/poker";

function checkThroughRound(game: GameState): GameState {
  const startingStreet = game.street;
  let current = game;
  let guard = 0;

  while (current.actor !== null && current.street === startingStreet && guard++ < 20) {
    const player = current.players[current.actor];
    if (!player) throw new Error("Missing actor");
    current = applyAction(
      current,
      current.currentBet === player.streetBet ? { type: "check" } : { type: "call" },
    );
  }

  if (guard >= 20) throw new Error(`Betting round did not complete on ${startingStreet}`);
  return current;
}

describe("betting street progression", () => {
  it("moves from preflop to flop and starts postflop action left of the dealer", () => {
    const initial = createHand(4, 1);
    const flop = checkThroughRound(initial);

    expect(flop.street).toBe("flop");
    expect(flop.revealedCount).toBe(3);
    expect(flop.actor).toBe(5);
    expect(flop.currentBet).toBe(0);
    expect(flop.players.every((p) => p.streetBet === 0)).toBe(true);
    expect(flop.pot).toBe(60);
  });

  it("progresses flop to turn to river, revealing one card at a time", () => {
    let game = checkThroughRound(createHand(4, 1));
    expect(game.street).toBe("flop");

    game = checkThroughRound(game);
    expect(game.street).toBe("turn");
    expect(game.revealedCount).toBe(4);
    expect(game.actor).toBe(5);

    game = checkThroughRound(game);
    expect(game.street).toBe("river");
    expect(game.revealedCount).toBe(5);
    expect(game.actor).toBe(5);
  });

  it("resolves showdown after river betting and preserves all chips", () => {
    let game = checkThroughRound(createHand(4, 1));
    game = checkThroughRound(game);
    game = checkThroughRound(game);
    const chipsBeforeShowdown =
      game.players.reduce((sum, player) => sum + player.stack, 0) + potTotal(game);

    game = checkThroughRound(game);

    const chipsAfterShowdown =
      game.players.reduce((sum, player) => sum + player.stack, 0) + potTotal(game);
    expect(game.street).toBe("complete");
    expect(game.actor).toBeNull();
    expect(game.revealedCount).toBe(5);
    expect(game.pot).toBe(0);
    expect(chipsAfterShowdown).toBe(chipsBeforeShowdown);
    expect(game.message).toMatch(/WINS|SPLIT/);
  });

  it("runs the board straight to showdown when everyone remaining is all-in preflop", () => {
    let game = createHand(4, 1);
    const heroSeat = 0;
    const villainSeat = 1;

    game = {
      ...game,
      actor: heroSeat,
      currentBet: 0,
      minRaise: 10,
      players: game.players.map((player, seat) => ({
        ...player,
        folded: seat > 1,
        allIn: false,
        hasActed: false,
        streetBet: 0,
        totalCommitted: 0,
        stack: seat <= 1 ? 100 : player.stack,
      })),
    };

    game = applyAction(game, { type: "raise", to: 100 });
    expect(game.actor).toBe(villainSeat);

    game = applyAction(game, { type: "call" });

    expect(game.street).toBe("complete");
    expect(game.actor).toBeNull();
    expect(game.revealedCount).toBe(5);
    expect(game.pot).toBe(0);
    expect(game.message).toMatch(/WINS|SPLIT/);
  });

  it("records ordered voluntary actions with street, seat, amount and pot context", () => {
    let game = createHand(4, 1);
    const firstSeat = game.actor!;
    const first = game.players[firstSeat]!;
    game = applyAction(game, { type: "raise", to: 30 });
    const secondSeat = game.actor!;
    game = applyAction(game, { type: "call" });

    expect(game.actionHistory).toHaveLength(2);
    expect(game.actionHistory[0]).toMatchObject({
      street: "preflop", seat: firstSeat, position: first.position,
      type: "raise", amount: 30, to: 30, potBefore: 15,
    });
    expect(game.actionHistory[1]).toMatchObject({
      street: "preflop", seat: secondSeat, type: "call", amount: 30, to: 30,
    });
  });

  it("preserves earlier street history after advancing to the flop", () => {
    const flop = checkThroughRound(createHand(4, 1));
    expect(flop.street).toBe("flop");
    expect(flop.actionHistory).toHaveLength(6);
    expect(flop.actionHistory.every((action) => action.street === "preflop")).toBe(true);

    const afterFlopAction = applyAction(flop, { type: "check" });
    expect(afterFlopAction.actionHistory).toHaveLength(7);
    expect(afterFlopAction.actionHistory[6]?.street).toBe("flop");
    expect(afterFlopAction.actionHistory[6]?.type).toBe("check");
  });

  it("starts each new hand with an empty action history", () => {
    let game = createHand(4, 1);
    game = applyAction(game, game.currentBet === game.players[game.actor!]!.streetBet ? { type: "check" } : { type: "call" });
    expect(game.actionHistory.length).toBeGreaterThan(0);
    const fresh = createHand(5, 2, game.players.map((p) => p.stack));
    expect(fresh.actionHistory).toEqual([]);
  });
});
