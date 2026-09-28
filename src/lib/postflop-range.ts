import { analyzePostflop } from "@/lib/postflop-analysis";
import type { WeightedCombo } from "@/lib/opponent-range";
import type { Card } from "@/lib/poker";

export type ObservedPostflopAction = "check" | "call" | "bet" | "raise";
export type BetSizeClass = "small" | "medium" | "large";

function clamp(v:number,min:number,max:number){ return Math.max(min,Math.min(max,v)); }

function likelihood(
  hole:[Card,Card],
  board:Card[],
  action:ObservedPostflopAction,
  size:BetSizeClass,
):number {
  const h=analyzePostflop(hole,board);
  const rank=h.handValue.categoryRank;
  const strong=rank>=2;
  const monster=rank>=3;
  const genuineDraw=(h.flushDraw&&h.holeCardFlushDraw)||(h.straightDraw!==null&&h.holeCardStraightDraw);
  const backdoor=h.backdoorFlushDraw||h.backdoorStraightDraw;
  const pair=rank===1;
  const sizePressure=size==="large"?1.35:size==="medium"?1.12:1;

  if(action==="check"){
    if(monster) return 0.42;
    if(strong) return 0.55;
    if(genuineDraw) return 0.62;
    return 0.88;
  }

  if(action==="call"){
    if(monster) return 0.55;
    if(strong) return 0.82;
    if(pair) return 0.72;
    if(genuineDraw) return 0.80;
    if(backdoor||h.overcards>0) return size==="small"?0.38:0.16;
    return size==="small"?0.22:0.07;
  }

  if(action==="bet"){
    if(monster) return clamp(0.78*sizePressure,0,1);
    if(strong) return clamp(0.72*sizePressure,0,1);
    if(pair) return size==="small"?0.50:0.30;
    if(genuineDraw) return clamp(0.58*sizePressure,0,0.90);
    if(backdoor||h.overcards>0) return size==="large"?0.22:0.34;
    return size==="small"?0.18:0.08;
  }

  // Raises polarise the range: strong value and credible semi-bluffs gain
  // weight, but bluff candidates are deliberately never hard-excluded.
  if(monster) return clamp(0.88*sizePressure,0,1);
  if(strong) return clamp(0.72*sizePressure,0,0.95);
  if(genuineDraw) return size==="large"?0.52:0.62;
  if(pair) return size==="small"?0.20:0.10;
  if(backdoor||h.overcards>0) return size==="large"?0.10:0.16;
  return 0.025;
}

/** Bayesian-style range update from one observed postflop action. */
export function reweightRangeForPostflopAction(
  range:WeightedCombo[],
  board:Card[],
  action:ObservedPostflopAction,
  size:BetSizeClass="medium",
):WeightedCombo[] {
  return range.map(combo=>({
    ...combo,
    weight:combo.weight*likelihood(combo.cards,board,action,size),
  })).filter(combo=>combo.weight>0);
}
