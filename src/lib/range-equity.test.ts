import { describe,expect,it } from "vitest";
import { riverEquityAgainstRange } from "@/lib/range-equity";
import { availableCombos, opponentRange } from "@/lib/opponent-range";
import type { Card } from "@/lib/poker";
const c=(rank:Card["rank"],suit:Card["suit"]):Card=>({rank,suit});
const h=(a:Card,b:Card):[Card,Card]=>[a,b];

describe("river range equity",()=>{
  it("reports 100% equity when hero has the unbeatable hand",()=>{
    const hero=h(c("A","spades"),c("K","spades"));
    const board=[c("Q","spades"),c("J","spades"),c("10","spades"),c("2","clubs"),c("3","diamonds")];
    const result=riverEquityAgainstRange(hero,board,availableCombos([...hero,...board]));
    expect(result.equity).toBe(1);
    expect(result.loss).toBe(0);
  });

  it("recognises a board-only tie against every possible opponent",()=>{
    const hero=h(c("2","clubs"),c("3","diamonds"));
    const board=[c("A","spades"),c("K","hearts"),c("Q","clubs"),c("J","diamonds"),c("10","spades")];
    const result=riverEquityAgainstRange(hero,board,availableCombos([...hero,...board]));
    expect(result.tie).toBe(1);
    expect(result.equity).toBe(0.5);
  });

  it("filters impossible opponent combinations containing hero or board cards",()=>{
    const hero=h(c("A","spades"),c("A","hearts"));
    const board=[c("K","clubs"),c("8","diamonds"),c("7","spades"),c("4","hearts"),c("2","clubs")];
    const unfiltered=availableCombos([]);
    const result=riverEquityAgainstRange(hero,board,unfiltered);
    expect(result.combinations).toBe(990);
  });

  it("shows river equity falling against a stronger action-weighted range",()=>{
    const hero=h(c("K","clubs"),c("Q","clubs"));
    const board=[c("K","diamonds"),c("9","spades"),c("7","hearts"),c("4","clubs"),c("2","diamonds")];
    const dead=[...hero,...board];
    const wide=opponentRange(dead,"BTN",["raise"]);
    const strong=opponentRange(dead,"UTG",["raise","three-bet"]);
    const wideEq=riverEquityAgainstRange(hero,board,wide).equity;
    const strongEq=riverEquityAgainstRange(hero,board,strong).equity;
    expect(wideEq).toBeGreaterThan(strongEq);
  });

  it("returns win tie and loss shares that sum to one",()=>{
    const hero=h(c("A","clubs"),c("J","clubs"));
    const board=[c("J","diamonds"),c("9","spades"),c("7","hearts"),c("4","clubs"),c("2","diamonds")];
    const result=riverEquityAgainstRange(hero,board,opponentRange([...hero,...board],"CO",["raise","call"]));
    expect(result.win+result.tie+result.loss).toBeCloseTo(1,10);
    expect(result.equity).toBeGreaterThanOrEqual(0);
    expect(result.equity).toBeLessThanOrEqual(1);
  });
});
