import { normalizedRange, opponentRange, type RangeAction, type WeightedCombo } from "@/lib/opponent-range";
import { reweightRangeForPostflopAction, type BetSizeClass, type ObservedPostflopAction } from "@/lib/postflop-range";
import { flopEquityAgainstRange, riverEquityAgainstRange, turnEquityAgainstRange, type EquityResult } from "@/lib/range-equity";
import type { Card, GameState, HandAction, Street } from "@/lib/poker";

/** Classify raises against the entire table's ordered preflop action history. */
export function preflopActionsForSeat(history:HandAction[],seat:number):RangeAction[] {
  let raisesAtTable=0;
  const result:RangeAction[]=[];
  for(const action of history){
    if(action.street!=="preflop") continue;
    if(action.type==="raise"){
      raisesAtTable++;
      if(action.seat===seat) result.push(raisesAtTable===1?"raise":raisesAtTable===2?"three-bet":"four-bet");
    } else if(action.seat===seat&&action.type==="call") result.push("call");
  }
  return result.length?result:["unopened"];
}

/** Pot-relative size of the incremental wager, accounting for an existing bet.
 * For a raise, compare the additional amount beyond calling with the pot
 * the raiser could win after making the call.
 */
export function postflopActionSizeClass(history:HandAction[],index:number):BetSizeClass {
  const action=history[index];
  if(!action) throw new Error("Unknown action index");
  if(action.type==="check"||action.type==="fold") return "medium";
  let previousTo=0;
  for(let i=index-1;i>=0;i--){
    const prior=history[i]!;
    if(prior.street!==action.street) continue;
    if(prior.seat!==action.seat) previousTo=Math.max(previousTo,prior.to);
  }
  const priorCommitment=action.to-action.amount;
  const toCall=Math.max(0,previousTo-priorCommitment);
  const wager=action.type==="raise"?Math.max(0,action.amount-toCall):action.amount;
  const denominator=action.potBefore+(action.type==="raise"?toCall:0);
  const fraction=denominator>0?wager/denominator:0;
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
  let range=opponentRange(deadCards,opponent.position,preflopActionsForSeat(game.actionHistory,opponentSeat));

  for(const [index,action] of game.actionHistory.entries()){
    if(action.seat!==opponentSeat || (action.street!=="flop"&&action.street!=="turn"&&action.street!=="river")) continue;
    const observed:ObservedPostflopAction=action.type==="raise"
      ? (action.to>action.amount?"raise":"bet")
      : action.type==="call"?"call"
      : action.type==="check"?"check"
      : "check";
    if(action.type==="fold") continue;
    range=reweightRangeForPostflopAction(range,visibleBoard(game,action.street),observed,postflopActionSizeClass(game.actionHistory,index));
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


/** Exact turn equity using an opponent range reconstructed through the turn. */
export function turnEquityFromHistory(game:GameState,heroSeat:number,opponentSeat:number):EquityResult {
  if(game.revealedCount!==4) throw new Error("Turn history equity requires exactly four board cards");
  const hero=game.players[heroSeat];
  if(!hero) throw new Error("Unknown hero seat");
  const board=game.communityCards.slice(0,4);
  const range=rangeFromActionHistory(game,opponentSeat,[...hero.cards,...board]);
  return turnEquityAgainstRange(hero.cards,board,range);
}

/** Exact flop equity versus the opponent's observed preflop and flop actions. */
export function flopEquityFromHistory(game:GameState,heroSeat:number,opponentSeat:number):EquityResult {
  if(game.revealedCount!==3) throw new Error("Flop history equity requires exactly three board cards");
  const hero=game.players[heroSeat];
  if(!hero) throw new Error("Unknown hero seat");
  const board=game.communityCards.slice(0,3);
  const range=rangeFromActionHistory(game,opponentSeat,[...hero.cards,...board]);
  return flopEquityAgainstRange(hero.cards,board,range);
}
