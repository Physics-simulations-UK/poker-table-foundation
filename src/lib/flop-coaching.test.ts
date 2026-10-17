import { describe, expect, it } from "vitest";
import { explainFlopDecision } from "@/lib/flop-coaching";
import type { HeroDecisionSnapshot } from "@/lib/hero-decision";

const card = (rank: "A"|"K"|"Q"|"9"|"7"|"2", suit: "hearts"|"spades"|"clubs"|"diamonds") => ({rank,suit});
const decision: HeroDecisionSnapshot = {
  handNumber:1,street:"flop",position:"BTN",
  holeCards:[card("A","spades"),card("9","diamonds")],
  board:[card("A","hearts"),card("7","hearts"),card("2","clubs")],
  potBefore:90,stackBefore:900,toCall:30,
  legalActions:{canFold:true,canCheck:false,canCall:true,callAmount:30,canRaise:true,minRaiseTo:60,maxRaiseTo:900},
  action:{type:"call"},precedingActions:[],
};
describe("flop coaching explanation",()=>{
  it("calculates 25% immediate pot odds and recognises top pair",()=>{
    const result=explainFlopDecision(decision)!;
    expect(result.potOddsPercent).toBe(25);
    expect(result.handStrength).toContain("top pair");
    expect(result.boardTexture).toContain("two-tone");
  });
  it("does not calculate call pot odds when checking",()=>{
    expect(explainFlopDecision({...decision,toCall:0,action:{type:"check"}})?.potOddsPercent).toBeNull();
  });
  it("does not analyse other streets as a flop",()=>{
    expect(explainFlopDecision({...decision,street:"preflop",board:[]})).toBeNull();
  });
});
