import type { Card, GameState, Position, Street } from "@/lib/poker";
import { getLegalActions, potTotal, type BetAction, type LegalActions } from "@/lib/betting";

/** Immutable information visible to the hero immediately before a decision. */
export interface HeroDecisionSnapshot {
  handNumber: number;
  street: Street;
  position: Position;
  holeCards: [Card, Card];
  board: Card[];
  potBefore: number;
  stackBefore: number;
  toCall: number;
  legalActions: LegalActions;
  action: BetAction;
  precedingActions: GameState["actionHistory"];
}

export function captureHeroDecision(game: GameState, action: BetAction): HeroDecisionSnapshot | null {
  if (game.actor === null) return null;
  const player = game.players[game.actor];
  const legal = getLegalActions(game);
  if (!player?.isHero || !legal) return null;
  const valid =
    action.type === "fold" ? legal.canFold :
    action.type === "check" ? legal.canCheck :
    action.type === "call" ? legal.canCall :
    legal.canRaise && Number.isInteger(action.to) && action.to <= legal.maxRaiseTo &&
      (action.to >= legal.minRaiseTo || action.to === legal.maxRaiseTo) &&
      action.to > game.currentBet;
  if (!valid) return null;
  return {
    handNumber: game.handNumber,
    street: game.street,
    position: player.position,
    holeCards: player.cards.map(card => ({ ...card })) as [Card, Card],
    board: game.communityCards.slice(0, game.revealedCount).map(card => ({ ...card })),
    potBefore: potTotal(game),
    stackBefore: player.stack,
    toCall: legal.callAmount,
    legalActions: { ...legal },
    action: { ...action },
    precedingActions: game.actionHistory.map(entry => ({ ...entry })),
  };
}
