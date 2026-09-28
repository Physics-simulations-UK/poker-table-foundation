import { describe, expect, it } from "vitest";
import { blendStrategies, chooseMixedAction, normalizeStrategy } from "@/lib/mixed-strategy";

describe("mixed strategy core", () => {
  it("normalises arbitrary positive weights", () => {
    expect(normalizeStrategy({ fold: 15, call: 55, raise: 30 })).toEqual({
      fold: 0.15,
      call: 0.55,
      raise: 0.3,
    });
  });

  it("selects actions at deterministic frequency boundaries", () => {
    const strategy = { fold: 0.15, call: 0.55, raise: 0.3 };
    expect(chooseMixedAction(strategy, 0.00).action).toBe("fold");
    expect(chooseMixedAction(strategy, 0.149).action).toBe("fold");
    expect(chooseMixedAction(strategy, 0.15).action).toBe("call");
    expect(chooseMixedAction(strategy, 0.699).action).toBe("call");
    expect(chooseMixedAction(strategy, 0.70).action).toBe("raise");
    expect(chooseMixedAction(strategy, 0.999).action).toBe("raise");
  });

  it("returns the selected action probability for future coaching explanations", () => {
    const result = chooseMixedAction({ fold: 1, call: 3 }, 0.5);
    expect(result.action).toBe("call");
    expect(result.probability).toBe(0.75);
    expect(result.distribution).toEqual({ fold: 0.25, call: 0.75 });
  });

  it("rejects invalid strategies and rolls", () => {
    expect(() => normalizeStrategy({ fold: 0, call: 0 })).toThrow();
    expect(() => normalizeStrategy({ fold: -1, call: 2 })).toThrow();
    expect(() => chooseMixedAction({ fold: 1 }, 1)).toThrow();
    expect(() => chooseMixedAction({ fold: 1 }, -0.1)).toThrow();
  });

  it("blends a baseline with a contextual adjustment", () => {
    const result = blendStrategies(
      { fold: 0.4, call: 0.4, raise: 0.2 },
      { fold: 0.1, call: 0.6, raise: 0.3 },
      0.5,
    );
    expect(result.fold).toBeCloseTo(0.25);
    expect(result.call).toBeCloseTo(0.5);
    expect(result.raise).toBeCloseTo(0.25);
  });

  it("can blend strategies containing different action sets", () => {
    const result = blendStrategies(
      { check: 0.8, bet: 0.2 },
      { check: 0.4, raise: 0.6 },
      0.25,
    );
    expect(result.check).toBeCloseTo(0.7);
    expect(result.bet).toBeCloseTo(0.15);
    expect(result.raise).toBeCloseTo(0.15);
  });
});
