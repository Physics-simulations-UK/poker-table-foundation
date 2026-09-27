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
});
