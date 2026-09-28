import { compareHandValues, evaluateHand } from "@/lib/hand-evaluator";
import type { WeightedCombo } from "@/lib/opponent-range";
import type { Card } from "@/lib/poker";

export interface EquityResult {
  equity: number;
  win: number;
  tie: number;
  loss: number;
  totalWeight: number;
  combinations: number;
}

const key=(c:Card)=>`${c.rank}-${c.suit}`;

/**
 * Exact showdown equity on a five-card board against a weighted opponent range.
 * Impossible opponent combinations are discarded using hero cards + board.
 * Equity = win share + half of tie share.
 */
export function riverEquityAgainstRange(
  hero:[Card,Card],
  board:Card[],
  range:WeightedCombo[],
):EquityResult {
  if(board.length!==5) throw new Error("River equity requires exactly five board cards");

  const dead=new Set([...hero,...board].map(key));
  const heroValue=evaluateHand([...hero,...board]);
  let winWeight=0,tieWeight=0,lossWeight=0,combinations=0;

  for(const combo of range){
    if(combo.weight<=0) continue;
    if(combo.cards.some(c=>dead.has(key(c)))) continue;
    const opponentValue=evaluateHand([...combo.cards,...board]);
    const comparison=compareHandValues(heroValue,opponentValue);
    if(comparison>0) winWeight+=combo.weight;
    else if(comparison<0) lossWeight+=combo.weight;
    else tieWeight+=combo.weight;
    combinations++;
  }

  const totalWeight=winWeight+tieWeight+lossWeight;
  if(!(totalWeight>0)) throw new Error("No possible opponent combinations remain");

  return {
    equity:(winWeight+tieWeight*0.5)/totalWeight,
    win:winWeight/totalWeight,
    tie:tieWeight/totalWeight,
    loss:lossWeight/totalWeight,
    totalWeight,
    combinations,
  };
}
