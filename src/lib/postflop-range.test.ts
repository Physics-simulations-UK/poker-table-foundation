import { describe,expect,it } from "vitest";
import { evaluateHand } from "@/lib/hand-evaluator";
import { normalizedRange, opponentRange } from "@/lib/opponent-range";
import { reweightRangeForPostflopAction } from "@/lib/postflop-range";
import type { Card } from "@/lib/poker";
const c=(rank:Card["rank"],suit:Card["suit"]):Card=>({rank,suit});

describe("postflop range reweighting",()=>{
  const board=[c("K","spades"),c("9","spades"),c("7","hearts"),c("4","clubs"),c("2","diamonds")];
  const dead=board;
  const base=()=>normalizedRange(opponentRange(dead,"BTN",["raise"]));
  const strongShare=(r:ReturnType<typeof base>)=>r.filter(x=>evaluateHand([...x.cards,...board]).categoryRank>=2).reduce((s,x)=>s+x.weight,0);
  const airShare=(r:ReturnType<typeof base>)=>r.filter(x=>evaluateHand([...x.cards,...board]).categoryRank===0).reduce((s,x)=>s+x.weight,0);

  it("a river raise increases the share of strong made hands",()=>{
    const before=base();
    const after=normalizedRange(reweightRangeForPostflopAction(before,board,"raise","large"));
    expect(strongShare(after)).toBeGreaterThan(strongShare(before));
  });

  it("a river call retains more one-pair hands than complete air",()=>{
    const after=normalizedRange(reweightRangeForPostflopAction(base(),board,"call","medium"));
    const pairs=after.filter(x=>evaluateHand([...x.cards,...board]).categoryRank===1).reduce((s,x)=>s+x.weight,0);
    expect(pairs).toBeGreaterThan(airShare(after));
  });

  it("checking shifts weight away from monsters without eliminating traps",()=>{
    const before=base();
    const after=normalizedRange(reweightRangeForPostflopAction(before,board,"check","medium"));
    expect(strongShare(after)).toBeLessThan(strongShare(before));
    expect(after.some(x=>evaluateHand([...x.cards,...board]).categoryRank>=3&&x.weight>0)).toBe(true);
  });

  it("large raises retain bluff combinations rather than becoming a value-only range",()=>{
    const after=normalizedRange(reweightRangeForPostflopAction(base(),board,"raise","large"));
    expect(after.some(x=>evaluateHand([...x.cards,...board]).categoryRank===0&&x.weight>0)).toBe(true);
  });

  it("successive aggressive actions progressively strengthen the range",()=>{
    const start=base();
    const flopBoard=board.slice(0,3);
    const turnBoard=board.slice(0,4);
    const afterFlop=reweightRangeForPostflopAction(start,flopBoard,"bet","medium");
    const afterTurn=reweightRangeForPostflopAction(afterFlop,turnBoard,"bet","large");
    const afterRiver=normalizedRange(reweightRangeForPostflopAction(afterTurn,board,"raise","large"));
    expect(strongShare(afterRiver)).toBeGreaterThan(strongShare(start));
  });
});
