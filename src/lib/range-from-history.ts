import { normalizedRange, opponentRange, type RangeAction, type WeightedCombo } from "@/lib/opponent-range";
import { reweightRangeForPostflopAction, type BetSizeClass, type ObservedPostflopAction } from "@/lib/postflop-range";
import { riverEquityAgainstRange, type EquityResult } from "@/lib/range-equity";
import type { Card, GameState, HandAction, Street } from "@/lib/poker";

function preflopActions(actions:HandAction[]):RangeAction[] {
  const raises=actions.filter(a=>a.type==="raise");
  if(raises.length===0) return actions.some(a=>a.type==="call")?["call"]:["unopened"];
  const result:RangeAction[]=[];
  for(let i=0;i<raises.length;i++) result.push(i===0?"raise":i===1?"three-bet":"four-bet");
  if(actions.at(-1)?.type==="call") result.push("call");
  return result;
}

function sizeClass(action:HandAction):BetSizeClass {
  if(action.type==="check") return "medium";
  const fraction=action.potBefore>0?action.amount/action.potBefore:0;
  if(fraction<=0.45) return "small";
  if(fraction<=0.8) return "medium";
  return "large";
}

function visibleBoard(game:GameState,street:Street):Card[] {
  const n=street==="flop"?3:street==="turn"?4:street==="river"||street==="complete"?5:0;
  return game.communityCards.slice(0,n);
}

/** Reconstruct one opponent's weighted range from their complete observed line. */
export function rangeFromActionHistory(game:GameState,opponentSeat:number,deadCards:Card[]):WeightedCombo[] {
  const opponent=game.players[opponentSeat];
  if(!opponent) throw new Error("Unknown opponent seat");
  const actions=game.actionHistory.filter(a=>a.seat===opponentSeat);
  const pre=actions.filter(a=>a.street==="preflop");
  let range=opponentRange(deadCards,opponent.position,preflopActions(pre));

  for(const action of actions.filter(a=>a.street==="flop"||a.street==="turn"||a.street==="river")){
    const observed:ObservedPostflopAction=action.type==="raise"
      ? (action.to>action.amount?"raise":"bet")
      : action.type==="call"?"call"
      : action.type==="check"?"check"
      : "check";
    if(action.type==="fold") continue;
    range=reweightRangeForPostflopAction(range,visibleBoard(game,action.street),observed,sizeClass(action));
  }
  return normalizedRange(range);
}

/** Exact river equity using an opponent range reconstructed from the whole hand. */
export function riverEquityFromHistory(game:GameState,heroSeat:number,opponentSeat:number):EquityResult {
  if(game.revealedCount!==5) throw new Error("History equity currently requires the river");
  const hero=game.players[heroSeat];
  if(!hero) throw new Error("Unknown hero seat");
  const board=game.communityCards.slice(0,5);
  const range=rangeFromActionHistory(game,opponentSeat,[...hero.cards,...board]);
  return riverEquityAgainstRange(hero.cards,board,range);
}
