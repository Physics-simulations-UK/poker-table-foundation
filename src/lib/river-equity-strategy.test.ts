import { describe,expect,it } from "vitest";
import { equityAdjustedRiverStrategy } from "@/lib/river-equity-strategy";
const base={fold:.25,call:.60,raise:.15};

describe("river equity strategy adjustment",()=>{
  it("folds much more often when equity is far below pot odds",()=>{
    const s=equityAdjustedRiverStrategy(base,.12,.40);
    expect(s.fold).toBeGreaterThan(.7);
    expect(s.call).toBeLessThan(base.call);
  });
  it("preserves mixed baseline near the indifferent threshold",()=>{
    const s=equityAdjustedRiverStrategy(base,.35,.33);
    expect(s.fold).toBeCloseTo(.25,8);
    expect(s.call).toBeCloseTo(.60,8);
    expect(s.raise).toBeCloseTo(.15,8);
  });
  it("calls more often with a modest positive equity edge",()=>{
    const s=equityAdjustedRiverStrategy(base,.43,.33);
    expect(s.call).toBeGreaterThan(base.call);
    expect(s.fold).toBeLessThan(base.fold);
  });
  it("retains calls and raises with a very large equity edge",()=>{
    const s=equityAdjustedRiverStrategy(base,.75,.30);
    expect(s.call).toBeGreaterThan(.3);
    expect(s.raise).toBeGreaterThan(.3);
    expect(s.fold).toBeLessThan(.1);
  });
});
