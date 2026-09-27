import type { GameState, Player, Street } from "@/lib/poker";
import { resolveShowdown } from "@/lib/showdown";

/** Chips are integers in tenths of a big blind to avoid floating-point drift. */
export const CHIPS_PER_BB = 10;
export const SMALL_BLIND = 5;
export const BIG_BLIND = 10;

export const toBB = (chips: number) => Math.round(chips) / CHIPS_PER_BB;
export const formatBB = (chips: number) => `${toBB(chips)}BB`;

export type BetAction =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; to: number };

export interface LegalActions {
  canFold: boolean;
  canCheck: boolean;
  canCall: boolean;
  callAmount: number;
  canRaise: boolean;
  minRaiseTo: number;
  maxRaiseTo: number;
}

const canAct = (p: Player) => !p.folded && !p.allIn;

export function potTotal(game: GameState) {
  return game.pot + game.players.reduce((sum, p) => sum + p.streetBet, 0);
}

function nextSeat(game: GameState, from: number, predicate: (p: Player) => boolean): number | null {
  const n = game.players.length;
  for (let step = 1; step <= n; step++) {
    const seat = (from + step) % n;
    const player = game.players[seat];
    if (player && predicate(player)) return seat;
  }
  return null;
}

/** Put chips from a player's stack into the current street; capped at their stack. */
function commit(player: Player, chips: number): Player {
  const amount = Math.max(0, Math.min(chips, player.stack));
  const stack = player.stack - amount;
  return {
    ...player,
    stack,
    streetBet: player.streetBet + amount,
    totalCommitted: player.totalCommitted + amount,
    allIn: stack === 0,
  };
}

/**
 * Resets per-street betting state. Reusable for every street; preflop blinds are
 * posted afterwards by postBlinds. Action starts left of `startAfterSeat`.
 */
export function startBettingRound(game: GameState, street: Street, startAfterSeat: number): GameState {
  const players = game.players.map((p) => ({ ...p, streetBet: 0, hasActed: false, lastAction: street === "preflop" ? null : p.lastAction }));
  const next = { ...game, players, street, currentBet: 0, minRaise: BIG_BLIND, message: null };
  return { ...next, actor: nextSeat(next, startAfterSeat, canAct) };
}

export function postBlinds(game: GameState): GameState {
  const sbSeat = (game.dealerSeat + 1) % game.players.length;
  const bbSeat = (game.dealerSeat + 2) % game.players.length;
  const players = game.players.map((p, seat) => {
    if (seat === sbSeat) { const q = commit(p, SMALL_BLIND); return { ...q, lastAction: `SB ${formatBB(q.streetBet)}` }; }
    if (seat === bbSeat) { const q = commit(p, BIG_BLIND); return { ...q, lastAction: `BB ${formatBB(q.streetBet)}` }; }
    return p;
  });
  const next = { ...game, players, currentBet: BIG_BLIND, minRaise: BIG_BLIND };
  return { ...next, actor: nextSeat(next, bbSeat, canAct) };
}

export function getLegalActions(game: GameState): LegalActions | null {
  if (game.actor === null) return null;
  const p = game.players[game.actor];
  if (!p || !canAct(p)) return null;
  const toCall = Math.max(0, game.currentBet - p.streetBet);
  const maxRaiseTo = p.streetBet + p.stack;
  const minRaiseTo = Math.min(game.currentBet + game.minRaise, maxRaiseTo);
  return {
    canFold: toCall > 0,
    canCheck: toCall === 0,
    canCall: toCall > 0,
    callAmount: Math.min(toCall, p.stack),
    canRaise: maxRaiseTo > game.currentBet,
    minRaiseTo,
    maxRaiseTo,
  };
}

function isRoundComplete(game: GameState) {
  return game.players.every((p) => p.folded || p.allIn || (p.hasActed && p.streetBet === game.currentBet));
}

function awardToLastPlayer(game: GameState, seat: number): GameState {
  const amount = potTotal(game);
  const players = game.players.map((p, i) => ({ ...p, streetBet: 0, stack: i === seat ? p.stack + amount : p.stack }));
  const winner = players[seat]!;
  return {
    ...game, players, pot: 0, actor: null, street: "complete",
    winner: { seat, amount },
    message: `${winner.isHero ? "HERO" : winner.name.toUpperCase()} WINS ${formatBB(amount)}`,
  };
}

function collectBets(game: GameState): GameState {
  return { ...game, pot: potTotal(game), players: game.players.map((p) => ({ ...p, streetBet: 0 })), currentBet: 0 };
}

function finishRound(game: GameState): GameState {
  const collected = collectBets(game);

  if (game.street === "river") {
    return resolveShowdown({ ...collected, revealedCount: 5 }).game;
  }

  const nextStreet: Street =
    game.street === "preflop" ? "flop" :
    game.street === "flop" ? "turn" :
    "river";
  const revealedCount: GameState["revealedCount"] =
    nextStreet === "flop" ? 3 :
    nextStreet === "turn" ? 4 :
    5;

  // Postflop action begins with the first active player clockwise from the
  // dealer. startBettingRound skips folded and all-in players.
  const next = startBettingRound(collected, nextStreet, game.dealerSeat);
  return {
    ...next,
    revealedCount,
    message: null,
  };
}

export function applyAction(game: GameState, action: BetAction): GameState {
  const legal = getLegalActions(game);
  const seat = game.actor;
  if (!legal || seat === null) return game;
  const player = game.players[seat]!;
  let updated: Player = player;
  let { currentBet, minRaise } = game;
  let reopen = false;

  switch (action.type) {
    case "fold":
      if (!legal.canFold) return game;
      updated = { ...player, folded: true, lastAction: "FOLD" };
      break;
    case "check":
      if (!legal.canCheck) return game;
      updated = { ...player, lastAction: "CHECK" };
      break;
    case "call": {
      if (!legal.canCall) return game;
      updated = commit(player, legal.callAmount);
      updated.lastAction = updated.allIn ? `ALL-IN ${formatBB(updated.streetBet)}` : `CALL ${formatBB(legal.callAmount)}`;
      break;
    }
    case "raise": {
      if (!legal.canRaise) return game;
      const to = Math.round(action.to);
      const isAllIn = to === legal.maxRaiseTo;
      if (to > legal.maxRaiseTo || (to < legal.minRaiseTo && !isAllIn) || to <= currentBet) return game;
      const increment = to - currentBet;
      if (increment >= minRaise) { minRaise = increment; reopen = true; }
      currentBet = to;
      updated = commit(player, to - player.streetBet);
      updated.lastAction = updated.allIn ? `ALL-IN ${formatBB(to)}` : `RAISE TO ${formatBB(to)}`;
      break;
    }
  }
  updated = { ...updated, hasActed: true };

  const players = game.players.map((p, i) => {
    if (i === seat) return updated;
    // A full raise reopens action for everyone still able to act.
    return reopen && canAct(p) ? { ...p, hasActed: false } : p;
  });
  const next: GameState = { ...game, players, currentBet, minRaise };

  const remaining = players.map((p, i) => (p.folded ? -1 : i)).filter((i) => i >= 0);
  if (remaining.length === 1) return awardToLastPlayer(next, remaining[0]!);
  if (isRoundComplete(next)) return finishRound(next);
  const actor = nextSeat(next, seat, (p) => canAct(p) && (!p.hasActed || p.streetBet < next.currentBet));
  return actor === null ? finishRound(next) : { ...next, actor };
}
