import type { Card, Position, Rank, Suit } from "@/lib/poker";

export type RangeAction = "unopened" | "call" | "raise" | "three-bet" | "four-bet";
export interface WeightedCombo { cards: [Card, Card]; weight: number; }

const ranks: Rank[] = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"];
const suits: Suit[] = ["spades","hearts","diamonds","clubs"];
const rankValue: Record<Rank, number> = { A:14,K:13,Q:12,J:11,"10":10,"9":9,"8":8,"7":7,"6":6,"5":5,"4":4,"3":3,"2":2 };
const positionWidth: Record<Position, number> = { UTG:-1.5,HJ:-0.7,CO:0.5,BTN:1.5,SB:0.9,BB:1.4 };
const key=(c:Card)=>`${c.rank}-${c.suit}`;

export function fullDeck(): Card[] {
  return ranks.flatMap(rank=>suits.map(suit=>({rank,suit})));
}

export function availableCombos(deadCards: Card[]): WeightedCombo[] {
  const dead=new Set(deadCards.map(key));
  const deck=fullDeck().filter(c=>!dead.has(key(c)));
  const combos:WeightedCombo[]=[];
  for(let i=0;i<deck.length;i++) for(let j=i+1;j<deck.length;j++) combos.push({cards:[deck[i]!,deck[j]!],weight:1});
  return combos;
}

export function comboQuality([a,b]:[Card,Card]):number {
  const hi=Math.max(rankValue[a.rank],rankValue[b.rank]);
  const lo=Math.min(rankValue[a.rank],rankValue[b.rank]);
  if(hi===lo) return 7+hi*0.75;
  let q=hi*0.62+lo*0.22;
  if(a.suit===b.suit) q+=1.15;
  const gap=hi-lo;
  if(gap===1) q+=1.1; else if(gap===2) q+=0.55; else if(gap>=5) q-=1;
  if(hi===14) q+=0.55;
  return q;
}

function actionLikelihood(q:number,position:Position,action:RangeAction):number {
  const adjusted=q+positionWidth[position];
  if(action==="unopened") return 1;
  if(action==="call") return Math.max(0.03,Math.min(1,(adjusted-5.2)/6));
  if(action==="raise") return Math.max(0.015,Math.min(1,(adjusted-6.4)/5.2));
  if(action==="three-bet") return Math.max(0.005,Math.min(1,(adjusted-9.4)/4.2));
  return Math.max(0.002,Math.min(1,(adjusted-11.3)/3.2));
}

/**
 * Continuous weighted opponent range. Actions change likelihoods rather than
 * hard-excluding hands, preserving mixed value and bluff combinations.
 */
export function opponentRange(deadCards:Card[],position:Position,actions:RangeAction[]):WeightedCombo[] {
  return availableCombos(deadCards).map(combo=>{
    const q=comboQuality(combo.cards);
    return {...combo,weight:actions.reduce((w,a)=>w*actionLikelihood(q,position,a),1)};
  }).filter(combo=>combo.weight>0);
}

export function normalizedRange(range:WeightedCombo[]):WeightedCombo[] {
  const total=range.reduce((sum,combo)=>sum+combo.weight,0);
  if(!(total>0)) throw new Error("Range must have positive weight");
  return range.map(combo=>({...combo,weight:combo.weight/total}));
}
