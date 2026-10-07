import { compareHandValues, evaluateHand } from "@/lib/hand-evaluator";
import { fullDeck, type WeightedCombo } from "@/lib/opponent-range";
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


/**
 * Exact turn equity against a weighted opponent range.
 * Enumerates every legal river card for every possible opponent holding.
 */
export function turnEquityAgainstRange(
  hero:[Card,Card],
  board:Card[],
  range:WeightedCombo[],
):EquityResult {
  if(board.length!==4) throw new Error("Turn equity requires exactly four board cards");

  const known=new Set([...hero,...board].map(key));
  let winWeight=0,tieWeight=0,lossWeight=0,combinations=0;

  for(const combo of range){
    if(combo.weight<=0) continue;
    if(combo.cards.some(c=>known.has(key(c)))) continue;

    const comboDead=new Set([...known,...combo.cards.map(key)]);
    const rivers=fullDeck().filter(c=>!comboDead.has(key(c)));
    for(const river of rivers){
      const finalBoard=[...board,river];
      const heroValue=evaluateHand([...hero,...finalBoard]);
      const opponentValue=evaluateHand([...combo.cards,...finalBoard]);
      const comparison=compareHandValues(heroValue,opponentValue);
      // Each river is equally likely conditional on this opponent combo.
      const weight=combo.weight/rivers.length;
      if(comparison>0) winWeight+=weight;
      else if(comparison<0) lossWeight+=weight;
      else tieWeight+=weight;
      combinations++;
    }
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


/**
 * Exact flop equity against a weighted opponent range.
 * Enumerates every unordered legal turn/river pair for each opponent holding.
 */
export function flopEquityAgainstRange(
  hero:[Card,Card],
  board:Card[],
  range:WeightedCombo[],
):EquityResult {
  if(board.length!==3) throw new Error("Flop equity requires exactly three board cards");

  const known=new Set([...hero,...board].map(key));
  let winWeight=0,tieWeight=0,lossWeight=0,combinations=0;

  for(const combo of range){
    if(combo.weight<=0) continue;
    if(combo.cards.some(c=>known.has(key(c)))) continue;

    const comboDead=new Set([...known,...combo.cards.map(key)]);
    const runoutDeck=fullDeck().filter(c=>!comboDead.has(key(c)));
    const runoutCount=runoutDeck.length*(runoutDeck.length-1)/2;

    for(let i=0;i<runoutDeck.length;i++){
      for(let j=i+1;j<runoutDeck.length;j++){
        const finalBoard=[...board,runoutDeck[i]!,runoutDeck[j]!];
        const heroValue=evaluateHand([...hero,...finalBoard]);
        const opponentValue=evaluateHand([...combo.cards,...finalBoard]);
        const comparison=compareHandValues(heroValue,opponentValue);
        const weight=combo.weight/runoutCount;
        if(comparison>0) winWeight+=weight;
        else if(comparison<0) lossWeight+=weight;
        else tieWeight+=weight;
        combinations++;
      }
    }
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
