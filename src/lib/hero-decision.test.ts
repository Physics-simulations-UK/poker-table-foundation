import { describe, expect, it } from "vitest";
import { captureHeroDecision } from "@/lib/hero-decision";
import { createHand } from "@/lib/poker";
import { getLegalActions } from "@/lib/betting";

describe("hero decision snapshot", () => {
  it("captures a legal hero decision without mutating game state", () => {
    const game = createHand();
    const hero = game.players.findIndex(p => p.isHero);
    const state = { ...game, actor: hero };
    const legal = getLegalActions(state)!;
    const action = legal.canCheck ? { type: "check" as const } : { type: "call" as const };
    const before = JSON.stringify(state);
    const snapshot = captureHeroDecision(state, action)!;
    expect(snapshot.handNumber).toBe(state.handNumber);
    expect(snapshot.holeCards).toEqual(state.players[hero]!.cards);
    expect(snapshot.potBefore).toBeGreaterThan(0);
    expect(snapshot.action).toEqual(action);
    expect(JSON.stringify(state)).toBe(before);
  });
  it("ignores bot actions and illegal decisions", () => {
    const game = createHand();
    const bot = game.players.findIndex(p => !p.isHero);
    expect(captureHeroDecision({ ...game, actor: bot }, { type: "fold" })).toBeNull();
    const hero = game.players.findIndex(p => p.isHero);
    expect(captureHeroDecision({ ...game, actor: hero }, { type: "raise", to: -10 })).toBeNull();
  });
  it("does not expose unrevealed board cards", () => {
    const game = createHand();
    const hero = game.players.findIndex(p => p.isHero);
    const state = { ...game, actor: hero };
    const legal = getLegalActions(state)!;
    const snapshot = captureHeroDecision(state, legal.canCheck ? { type: "check" } : { type: "call" })!;
    expect(snapshot.board).toHaveLength(0);
  });
});
