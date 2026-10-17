import { describe, expect, it } from "vitest";
import { normalizeStrategy } from "@/lib/mixed-strategy";
import { analyzePostflop } from "@/lib/postflop-analysis";
import { mixedPostflopStrategy, multiwayRiverAdjustment, riverHighCardDiscipline, riverFlushCompletionDiscipline } from "@/lib/postflop-mixed-strategy";
import type { PostflopContext } from "@/lib/postflop-context";
import type { Card, Rank, Suit } from "@/lib/poker";

const suitMap: Record<string, Suit> = { s: "spades", h: "hearts", d: "diamonds", c: "clubs" };
function cards(text: string): Card[] {
  return text.split(" ").map((token) => ({ rank: token.slice(0, -1) as Rank, suit: suitMap[token.slice(-1)]! }));
}
const hole = (text: string) => cards(text) as [Card, Card];

function ctx(overrides: Partial<PostflopContext> = {}): PostflopContext {
  return {
    pot: 100, toCall: 0, potOdds: 0, spr: 6, activeOpponents: 1, inPosition: true,
    board: { pairedness: "unpaired", connectivity: "disconnected", suitTexture: "rainbow", highCard: 14 },
    ...overrides,
  };
}

describe("mixed postflop strategy", () => {
  it("mixes value bet sizes with a set rather than using one fixed action", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx()));
    expect(strategy.check).toBeGreaterThan(0);
    expect(strategy["bet-small"]).toBeGreaterThan(0);
    expect(strategy["bet-medium"]).toBeGreaterThan(0);
  });

  it("mostly continues top pair at an ordinary price but retains alternatives", () => {
    const hand = analyzePostflop(hole("As 9d"), cards("Ah 7c 2s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 30, potOdds: 0.23 })));
    expect(strategy.call).toBeGreaterThan(strategy.fold);
    expect(strategy.raise).toBeGreaterThan(0);
    expect(strategy.fold).toBeGreaterThan(0);
  });

  it("gives a genuine combo draw meaningful semi-bluff frequency", () => {
    const hand = analyzePostflop(hole("9s 8s"), cards("7s 6h 2s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 30, potOdds: 0.23 })));
    expect(strategy.raise).toBeGreaterThan(0.3);
    expect(strategy.call).toBeGreaterThan(0);
  });

  it("does not mistake a board-only four-flush for a player's flush draw", () => {
    const hand = analyzePostflop(hole("Ah 5d"), cards("Ks 8s 2s 3s"));
    expect(hand.flushDraw).toBe(true);
    expect(hand.holeCardFlushDraw).toBe(false);
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 30, potOdds: 0.23 })));
    expect(strategy.fold).toBeGreaterThan(strategy.raise);
  });

  it("continues two overcards with useful potential more than complete air", () => {
    const useful = analyzePostflop(hole("As Kd"), cards("Qh 7c 2s"));
    const air = analyzePostflop(hole("8h 3d"), cards("Qh 7c 2s"));
    const situation = ctx({ toCall: 15, potOdds: 0.13 });
    const usefulStrategy = normalizeStrategy(mixedPostflopStrategy(useful, situation));
    const airStrategy = normalizeStrategy(mixedPostflopStrategy(air, situation));
    expect(usefulStrategy.call).toBeGreaterThan(airStrategy.call);
  });

  it("bluffs useful air more often heads-up in position than multiway", () => {
    const hand = analyzePostflop(hole("As Kd"), cards("Qh 7c 2s"));
    const headsUp = normalizeStrategy(mixedPostflopStrategy(hand, ctx()));
    const multiway = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ activeOpponents: 3 })));
    expect((headsUp["bet-small"] ?? 0) + (headsUp["bet-medium"] ?? 0))
      .toBeGreaterThan((multiway["bet-small"] ?? 0) + (multiway["bet-medium"] ?? 0));
  });

  it("makes weak-pair calls sensitive to the price", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Qh 9c 2s"));
    const cheap = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 15, potOdds: 0.13 })));
    const expensive = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 60, potOdds: 0.38 })));
    expect(cheap.call).toBeGreaterThan(expensive.call);
  });

  it("keeps strong made hands from becoming automatic raises", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx({ toCall: 30, potOdds: 0.23 })));
    expect(strategy.call).toBeGreaterThan(0.4);
    expect(strategy.raise).toBeGreaterThan(0.4);
    expect(strategy.raise).toBeLessThan(0.6);
  });

  it("checks strong made hands often enough to protect the checking range", () => {
    const hand = analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s"));
    const strategy = normalizeStrategy(mixedPostflopStrategy(hand, ctx()));
    expect(strategy.check).toBeGreaterThan(0.25);
  });

  it("lets combo draws raise at least as often as ordinary strong made hands", () => {
    const value = analyzePostflop(hole("6s 6d"), cards("Ah 6c 3s"));
    const draw = analyzePostflop(hole("9s 8s"), cards("7s 6h 2s"));
    const situation = ctx({ toCall: 30, potOdds: 0.23 });
    const valueStrategy = normalizeStrategy(mixedPostflopStrategy(value, situation));
    const drawStrategy = normalizeStrategy(mixedPostflopStrategy(draw, situation));
    expect(drawStrategy.raise).toBeGreaterThanOrEqual(valueStrategy.raise);
  });
});

describe("river multiway aggression discipline",()=>{
  it("reduces two-pair raises against multiple opponents",()=>{
    const hand=analyzePostflop(hole("Kh 9d"),cards("Ks 9c 7h 4d 2c"));
    const situation=ctx({activeOpponents:3,toCall:40,potOdds:0.25});
    const baseline=normalizeStrategy(mixedPostflopStrategy(hand,situation));
    const adjusted=normalizeStrategy(multiwayRiverAdjustment(baseline,hand,situation));
    expect(adjusted.raise).toBeLessThan(baseline.raise);
    expect(adjusted.call).toBeGreaterThan(baseline.call);
  });
  it("retains substantial value aggression with a set",()=>{
    const hand=analyzePostflop(hole("6s 6d"),cards("Ah 6c 3s 9d 2h"));
    const situation=ctx({activeOpponents:2,toCall:30,potOdds:0.2});
    const baseline=normalizeStrategy(mixedPostflopStrategy(hand,situation));
    const adjusted=normalizeStrategy(multiwayRiverAdjustment(baseline,hand,situation));
    expect(adjusted.raise).toBeGreaterThan(0.3);
    expect(adjusted.raise).toBeLessThan(baseline.raise);
  });
  it("preserves heads-up decisions",()=>{
    const hand=analyzePostflop(hole("Kh 9d"),cards("Ks 9c 7h 4d 2c"));
    const situation=ctx({activeOpponents:1,toCall:40,potOdds:0.25});
    const baseline=mixedPostflopStrategy(hand,situation);
    expect(multiwayRiverAdjustment(baseline,hand,situation)).toEqual(baseline);
  });
  it("checks more frequently rather than bluff-betting multiway",()=>{
    const hand=analyzePostflop(hole("As Qd"),cards("Kh 8c 3s 6d 2h"));
    const situation=ctx({activeOpponents:3});
    const baseline=normalizeStrategy(mixedPostflopStrategy(hand,situation));
    const adjusted=normalizeStrategy(multiwayRiverAdjustment(baseline,hand,situation));
    expect(adjusted.check).toBeGreaterThan(baseline.check);
  });
});

describe("river high-card bluff-catching discipline",()=>{
  it("limits weak high-card calls even against cheap bets",()=>{
    const hand=analyzePostflop(hole("As Qd"),cards("Kh 8c 3s 6d 2h"));
    const strategy=riverHighCardDiscipline({fold:0.20,call:0.75,raise:0.05},hand,ctx({toCall:10,potOdds:0.09}));
    expect(strategy.call).toBeLessThanOrEqual(0.18);
    expect(strategy.fold).toBeGreaterThan(0.79);
  });
  it("is tighter against multiple opponents",()=>{
    const hand=analyzePostflop(hole("As Qd"),cards("Kh 8c 3s 6d 2h"));
    const strategy=riverHighCardDiscipline({fold:0.20,call:0.75,raise:0.05},hand,ctx({activeOpponents:3,toCall:10,potOdds:0.09}));
    expect(strategy.call).toBeLessThanOrEqual(0.05);
  });
  it("leaves genuine made pairs unchanged",()=>{
    const hand=analyzePostflop(hole("Ks Qd"),cards("Kh 8c 3s 6d 2h"));
    const baseline={fold:0.1,call:0.8,raise:0.1};
    expect(riverHighCardDiscipline(baseline,hand,ctx({toCall:10,potOdds:0.09}))).toEqual(baseline);
  });
});

describe("river flush completion bluff-catching",()=>{
  const hand=analyzePostflop(hole("10s 10d"),cards("Kh 8h 3c 6d 2h"));
  const baseline={fold:0.30,call:0.66,raise:0.04};
  it("reduces one-pair calls facing a third suited river card and sustained betting",()=>{
    const adjusted=riverFlushCompletionDiscipline(baseline,hand,ctx({toCall:40,potOdds:0.25}),true,true);
    expect(adjusted.call).toBeLessThan(baseline.call);
    expect(adjusted.fold).toBeGreaterThan(baseline.fold);
    expect(adjusted.call).toBeGreaterThan(0);
  });
  it("does not overreact when the river did not complete the flush threat",()=>{
    expect(riverFlushCompletionDiscipline(baseline,hand,ctx({toCall:40,potOdds:0.25}),false,true)).toEqual(baseline);
  });
  it("preserves calls without a three-street betting line",()=>{
    expect(riverFlushCompletionDiscipline(baseline,hand,ctx({toCall:40,potOdds:0.25}),true,false)).toEqual(baseline);
  });
});
