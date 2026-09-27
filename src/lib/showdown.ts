import { compareHandValues, evaluateHand, type HandValue } from "@/lib/hand-evaluator";
import type { GameState } from "@/lib/poker";

export interface ShowdownResult {
  game: GameState;
  winners: number[];
  hands: Map<number, HandValue>;
}

/**
 * Resolves a single-pot showdown. Side pots are intentionally handled in the
 * next engine stage; this function is for hands where all live players contest
 * the same pot.
 */
export function resolveShowdown(game: GameState): ShowdownResult {
  const contenders = game.players
    .map((player, seat) => ({ player, seat }))
    .filter(({ player }) => !player.folded);

  if (contenders.length < 2) throw new Error("Showdown requires at least two live players");
  if (game.revealedCount !== 5) throw new Error("Showdown requires all five community cards");

  const hands = new Map<number, HandValue>();
  for (const { player, seat } of contenders) {
    hands.set(seat, evaluateHand([...player.cards, ...game.communityCards]));
  }

  let winners: number[] = [];
  let best: HandValue | null = null;
  for (const { seat } of contenders) {
    const hand = hands.get(seat)!;
    if (best === null || compareHandValues(hand, best) > 0) {
      best = hand;
      winners = [seat];
    } else if (compareHandValues(hand, best) === 0) {
      winners.push(seat);
    }
  }

  const amount = game.pot + game.players.reduce((sum, player) => sum + player.streetBet, 0);
  const share = Math.floor(amount / winners.length);
  let remainder = amount - share * winners.length;

  // Odd chips are assigned clockwise from the dealer among tied winners.
  const orderedWinners = [...winners].sort((a, b) => {
    const da = (a - game.dealerSeat + game.players.length) % game.players.length;
    const db = (b - game.dealerSeat + game.players.length) % game.players.length;
    return da - db;
  });

  const payouts = new Map<number, number>();
  for (const seat of orderedWinners) {
    const payout = share + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
    payouts.set(seat, payout);
  }

  const players = game.players.map((player, seat) => ({
    ...player,
    stack: player.stack + (payouts.get(seat) ?? 0),
    streetBet: 0,
  }));

  const winnerNames = winners.map((seat) => {
    const player = players[seat]!;
    return player.isHero ? "HERO" : player.name.toUpperCase();
  });
  const category = best?.category.replaceAll("-", " ").toUpperCase() ?? "HAND";
  const message =
    winners.length === 1
      ? `${winnerNames[0]} WINS ${amount / 10}BB — ${category}`
      : `${winnerNames.join(" & ")} SPLIT ${amount / 10}BB — ${category}`;

  return {
    game: {
      ...game,
      players,
      pot: 0,
      currentBet: 0,
      actor: null,
      street: "complete",
      winner: winners.length === 1 ? { seat: winners[0]!, amount } : null,
      message,
    },
    winners,
    hands,
  };
}
