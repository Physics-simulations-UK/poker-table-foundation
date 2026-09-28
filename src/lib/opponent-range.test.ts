import { describe, expect, it } from "vitest";
import { availableCombos, comboQuality, normalizedRange, opponentRange } from "@/lib/opponent-range";
import type { Card } from "@/lib/poker";
const c=(rank:Card["rank"],suit:Card["suit"]):Card=>({rank,suit});
const hand=(a:Card,b:Card):[Card,Card]=>[a,b];

describe("opponent range model",()=>{
  it("generates all 1326 starting combinations with no dead cards",()=>expect(availableCombos([])).toHaveLength(1326));
  it("removes combinations containing known cards",()=>expect(availableCombos([c("A","spades"),c("K","hearts")])).toHaveLength(1225));
  it("scores premiums above speculative and trash hands",()=>{
    expect(comboQuality(hand(c("A","spades"),c("A","hearts")))).toBeGreaterThan(comboQuality(hand(c("9","spades"),c("8","spades"))));
    expect(comboQuality(hand(c("9","spades"),c("8","spades")))).toBeGreaterThan(comboQuality(hand(c("7","clubs"),c("2","diamonds"))));
  });
  it("makes an early-position raise range stronger than a button raise range",()=>{
    const utg=normalizedRange(opponentRange([],"UTG",["raise"]));
    const btn=normalizedRange(opponentRange([],"BTN",["raise"]));
    const weak=(r:typeof utg)=>r.filter(x=>comboQuality(x.cards)<8).reduce((s,x)=>s+x.weight,0);
    expect(weak(btn)).toBeGreaterThan(weak(utg));
  });
  it("reweights toward premiums after a three-bet without hard excluding bluffs",()=>{
    const opened=normalizedRange(opponentRange([],"BTN",["raise"]));
    const three=normalizedRange(opponentRange([],"BTN",["raise","three-bet"]));
    const premium=(r:typeof opened)=>r.filter(x=>comboQuality(x.cards)>14).reduce((s,x)=>s+x.weight,0);
    expect(premium(three)).toBeGreaterThan(premium(opened));
    expect(three.some(x=>comboQuality(x.cards)<10&&x.weight>0)).toBe(true);
  });
  it("normalizes range weights to one",()=>{
    const r=normalizedRange(opponentRange([],"CO",["raise","call"]));
    expect(r.reduce((s,x)=>s+x.weight,0)).toBeCloseTo(1,10);
  });
});
