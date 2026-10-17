import {describe,it,expect} from "vitest";
import {fastSevenCardScore} from "@/lib/fast-seven-card";
import {evaluateHand,compareHandValues} from "@/lib/hand-evaluator";
import {fullDeck} from "@/lib/opponent-range";
describe("fast seven-card evaluator parity",()=>{
  it("agrees with reference evaluator on 1000 reproducible seven-card samples",()=>{
    const deck=fullDeck();
    let seed=123456789;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let n=0;n<1000;n++){
      const sample=[...deck];
      for(let i=0;i<7;i++){const j=i+Math.floor(random()*(52-i));[sample[i],sample[j]]=[sample[j]!,sample[i]!];}
      const hand=sample.slice(0,7);
      const fast=fastSevenCardScore(hand);
      const ref=evaluateHand(hand);
      expect(Math.floor(fast/759375)).toBe(ref.categoryRank);
      const other=sample.slice(7,14);
      const comparison=compareHandValues(ref,evaluateHand(other));
      const quick=fast-fastSevenCardScore(other);
      expect(Math.sign(quick)).toBe(Math.sign(comparison));
    }
  });
});
