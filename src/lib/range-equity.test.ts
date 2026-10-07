import { describe,expect,it } from "vitest";
import { flopEquityAgainstRange, riverEquityAgainstRange, turnEquityAgainstRange } from "@/lib/range-equity";
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


describe("turn range equity",()=>{
  it("enumerates every legal river for every possible opponent combo",()=>{
    const hero=h(c("A","spades"),c("A","hearts"));
    const board=[c("K","clubs"),c("8","diamonds"),c("7","spades"),c("4","hearts")];
    const range=availableCombos([...hero,...board]);
    const result=turnEquityAgainstRange(hero,board,range);
    // 46 unseen cards -> C(46,2)=1035 opponent combos, then 44 legal rivers.
    expect(result.combinations).toBe(1035*44);
    expect(result.win+result.tie+result.loss).toBeCloseTo(1,10);
  });

  it("gives a made royal flush 100% turn equity",()=>{
    const hero=h(c("A","spades"),c("K","spades"));
    const board=[c("Q","spades"),c("J","spades"),c("10","spades"),c("2","clubs")];
    const result=turnEquityAgainstRange(hero,board,availableCombos([...hero,...board]));
    expect(result.equity).toBe(1);
    expect(result.loss).toBe(0);
  });

  it("includes river improvement rather than judging only current hand strength",()=>{
    const hero=h(c("A","spades"),c("Q","spades"));
    const board=[c("K","spades"),c("7","spades"),c("2","diamonds"),c("4","clubs")];
    const villain:[Card,Card]=h(c("K","hearts"),c("J","hearts"));
    const result=turnEquityAgainstRange(hero,board,[{cards:villain,weight:1}]);
    expect(result.equity).toBeGreaterThan(0);
    expect(result.equity).toBeLessThan(0.5);
  });
});


describe("flop full-range performance",()=>{
  it("calculates exact equity against a realistic weighted preflop range",()=>{
    const hero=h(c("A","clubs"),c("Q","clubs"));
    const board=[c("Q","diamonds"),c("9","spades"),c("7","hearts")];
    const range=opponentRange([...hero,...board],"BTN",["raise","call"]);
    const started=performance.now();
    const result=flopEquityAgainstRange(hero,board,range);
    const elapsed=performance.now()-started;
    expect(result.equity).toBeGreaterThanOrEqual(0);
    expect(result.equity).toBeLessThanOrEqual(1);
    expect(result.win+result.tie+result.loss).toBeCloseTo(1,10);
    expect(result.combinations).toBeGreaterThan(1_000_000);
    console.info("exact flop full-range equity: "+elapsed.toFixed(0)+" ms for "+result.combinations+" runouts");
  },30000);
});

describe("flop range equity",()=>{
  it("enumerates every legal unordered turn/river runout for a fixed opponent hand",()=>{
    const hero=h(c("A","spades"),c("A","hearts"));
    const board=[c("K","clubs"),c("8","diamonds"),c("7","spades")];
    const villain=h(c("K","hearts"),c("Q","hearts"));
    const result=flopEquityAgainstRange(hero,board,[{cards:villain,weight:1}]);
    // Seven known cards leave 45 unseen: C(45,2)=990 runouts.
    expect(result.combinations).toBe(990);
    expect(result.win+result.tie+result.loss).toBeCloseTo(1,10);
  });

  it("gives a flopped royal flush 100% equity",()=>{
    const hero=h(c("A","spades"),c("K","spades"));
    const board=[c("Q","spades"),c("J","spades"),c("10","spades")];
    const villain=h(c("9","hearts"),c("9","clubs"));
    const result=flopEquityAgainstRange(hero,board,[{cards:villain,weight:1}]);
    expect(result.equity).toBe(1);
    expect(result.loss).toBe(0);
  });

  it("includes two-card future improvement from the flop",()=>{
    const hero=h(c("A","spades"),c("Q","spades"));
    const board=[c("K","spades"),c("7","spades"),c("2","diamonds")];
    const villain=h(c("K","hearts"),c("J","hearts"));
    const result=flopEquityAgainstRange(hero,board,[{cards:villain,weight:1}]);
    expect(result.equity).toBeGreaterThan(0);
    expect(result.equity).toBeLessThan(0.5);
  });
});
