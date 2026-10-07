import { describe,expect,it } from "vitest";
import { rangeFromActionHistory, riverEquityFromHistory, turnEquityFromHistory } from "@/lib/range-from-history";
import { comboQuality } from "@/lib/opponent-range";
import { createHand, type GameState, type HandAction } from "@/lib/poker";

const action=(overrides:Partial<HandAction>):HandAction=>({
  street:"preflop",seat:1,position:"BTN",type:"call",amount:10,to:10,potBefore:15,...overrides,
});

function riverGame(history:HandAction[]):GameState {
  const game=createHand(0,1);
  return {...game,revealedCount:5,street:"river",actionHistory:history};
}

describe("range reconstruction from hand history",()=>{
  it("uses the opponent's full preflop line to strengthen a three-bet range",()=>{
    const passive=riverGame([action({type:"call"})]);
    const aggressive=riverGame([action({type:"raise",amount:25,to:25}),action({type:"raise",amount:60,to:85})]);
    const dead=[...passive.players[0]!.cards,...passive.communityCards];
    const p=rangeFromActionHistory(passive,1,dead);
    const a=rangeFromActionHistory(aggressive,1,dead);
    const premium=(r:typeof p)=>r.filter(x=>comboQuality(x.cards)>14).reduce((s,x)=>s+x.weight,0);
    expect(premium(a)).toBeGreaterThan(premium(p));
  });

  it("uses postflop actions on their correct streets",()=>{
    const history=[
      action({type:"raise",amount:25,to:25}),
      action({street:"flop",type:"check",amount:0,to:0,potBefore:60}),
      action({street:"turn",type:"call",amount:30,to:30,potBefore:90}),
      action({street:"river",type:"raise",amount:120,to:180,potBefore:180}),
    ];
    const game=riverGame(history);
    const range=rangeFromActionHistory(game,1,[...game.players[0]!.cards,...game.communityCards]);
    expect(range.reduce((s,x)=>s+x.weight,0)).toBeCloseTo(1,10);
  });

  it("produces different river equity for passive and aggressive opponent lines",()=>{
    const game=createHand(0,1);
    const passive:GameState={...game,revealedCount:5,street:"river",actionHistory:[
      action({type:"call"}),action({street:"flop",type:"check",amount:0,to:0,potBefore:60}),action({street:"turn",type:"check",amount:0,to:0,potBefore:60}),action({street:"river",type:"check",amount:0,to:0,potBefore:60}),
    ]};
    const aggressive:GameState={...passive,actionHistory:[
      action({type:"raise",amount:25,to:25}),action({street:"flop",type:"raise",amount:40,to:40,potBefore:60}),action({street:"turn",type:"raise",amount:80,to:80,potBefore:140}),action({street:"river",type:"raise",amount:180,to:180,potBefore:300}),
    ]};
    const p=riverEquityFromHistory(passive,0,1).equity;
    const a=riverEquityFromHistory(aggressive,0,1).equity;
    expect(p).not.toBeCloseTo(a,6);
  });
});


describe("turn equity from hand history",()=>{
  it("reconstructs the range through the turn and returns valid exact equity",()=>{
    const game=createHand(0,1);
    const turn:GameState={...game,revealedCount:4,street:"turn",actionHistory:[
      action({type:"raise",amount:25,to:25}),
      action({street:"flop",type:"call",amount:30,to:30,potBefore:60}),
      action({street:"turn",type:"raise",amount:70,to:70,potBefore:120}),
    ]};
    const result=turnEquityFromHistory(turn,0,1);
    expect(result.equity).toBeGreaterThanOrEqual(0);
    expect(result.equity).toBeLessThanOrEqual(1);
    expect(result.win+result.tie+result.loss).toBeCloseTo(1,10);
    expect(result.combinations).toBeGreaterThan(0);
  });

  it("changes turn equity when the opponent line represents a different range",()=>{
    const game=createHand(0,1);
    const passive:GameState={...game,revealedCount:4,street:"turn",actionHistory:[
      action({type:"call"}),
      action({street:"flop",type:"check",amount:0,to:0,potBefore:60}),
      action({street:"turn",type:"call",amount:25,to:25,potBefore:80}),
    ]};
    const aggressive:GameState={...passive,actionHistory:[
      action({type:"raise",amount:25,to:25}),
      action({street:"flop",type:"raise",amount:50,to:50,potBefore:60}),
      action({street:"turn",type:"raise",amount:100,to:100,potBefore:160}),
    ]};
    expect(turnEquityFromHistory(passive,0,1).equity)
      .not.toBeCloseTo(turnEquityFromHistory(aggressive,0,1).equity,6);
  });
});
