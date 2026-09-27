import { compareHandValues, evaluateHand, type HandValue } from "@/lib/hand-evaluator";
import type { GameState } from "@/lib/poker";

export interface ShowdownResult {
  game: GameState;
  winners: number[];
  hands: Map<number, HandValue>;
}

interface PotLayer {
  amount: number;
  eligible: number[];
}

function buildPotLayers(game: GameState): PotLayer[] {
  const levels = [...new Set(game.players.map((p) => p.totalCommitted).filter((n) => n > 0))].sort((a, b) => a - b);
  const layers: PotLayer[] = [];
  let previous = 0;

  for (const level of levels) {
    const contributors = game.players
      .map((p, seat) => ({ p, seat }))
      .filter(({ p }) => p.totalCommitted >= level);
    const amount = (level - previous) * contributors.length;
    if (amount > 0) {
      layers.push({
        amount,
        eligible: contributors.filter(({ p }) => !p.folded).map(({ seat }) => seat),
      });
    }
    previous = level;
  }
  return layers;
}

function clockwiseFromDealer(seats: number[], dealer: number, count: number) {
  return [...seats].sort((a, b) =>
    ((a - dealer + count) % count) - ((b - dealer + count) % count));
}

/** Resolve main/side pots from each player's total contribution. */
export function resolveShowdown(game: GameState): ShowdownResult {
  const contenders = game.players.map((player, seat) => ({ player, seat })).filter(({ player }) => !player.folded);
  if (contenders.length < 2) throw new Error("Showdown requires at least two live players");
  if (game.revealedCount !== 5) throw new Error("Showdown requires all five community cards");

  const hands = new Map<number, HandValue>();
  for (const { player, seat } of contenders) hands.set(seat, evaluateHand([...player.cards, ...game.communityCards]));

  const payouts = new Map<number, number>();
  const winningSeats = new Set<number>();
  const layers = buildPotLayers(game);
  const committedTotal = game.players.reduce((sum, p) => sum + p.totalCommitted, 0);
  const tableTotal = game.pot + game.players.reduce((sum, p) => sum + p.streetBet, 0);

  // totalCommitted defines side-pot eligibility. game.pot/streetBet define the
  // chips physically on the table. Normal engine states contain the same chips
  // in both representations, while older fixtures may provide only game.pot.
  if (committedTotal === 0 && tableTotal > 0) {
    layers.push({ amount: tableTotal, eligible: contenders.map(({ seat }) => seat) });
  } else if (tableTotal > committedTotal) {
    layers.push({ amount: tableTotal - committedTotal, eligible: contenders.map(({ seat }) => seat) });
  }

  for (const layer of layers) {
    if (layer.eligible.length === 0) continue;
    let best: HandValue | null = null;
    let winners: number[] = [];
    for (const seat of layer.eligible) {
      const hand = hands.get(seat)!;
      if (best === null || compareHandValues(hand, best) > 0) { best = hand; winners = [seat]; }
      else if (compareHandValues(hand, best) === 0) winners.push(seat);
    }
    const ordered = clockwiseFromDealer(winners, game.dealerSeat, game.players.length);
    const share = Math.floor(layer.amount / winners.length);
    let remainder = layer.amount % winners.length;
    for (const seat of ordered) {
      payouts.set(seat, (payouts.get(seat) ?? 0) + share + (remainder > 0 ? 1 : 0));
      if (remainder > 0) remainder--;
      winningSeats.add(seat);
    }
  }

  const distributed = [...payouts.values()].reduce((a, b) => a + b, 0);
  const expected = Math.max(committedTotal, tableTotal);
  if (distributed !== expected) throw new Error("Side-pot distribution did not conserve chips");

  const players = game.players.map((player, seat) => ({
    ...player, stack: player.stack + (payouts.get(seat) ?? 0), streetBet: 0,
  }));
  const winners = [...winningSeats];
  const names = winners.map((seat) => players[seat]!.isHero ? "HERO" : players[seat]!.name.toUpperCase());
  const message = layers.length > 1
    ? `SHOWDOWN — ${names.join(", ")} WIN POT(S)`
    : winners.length === 1
      ? `${names[0]} WINS ${distributed / 10}BB — ${hands.get(winners[0]!)!.category.replaceAll("-", " ").toUpperCase()}`
      : `${names.join(" & ")} SPLIT ${distributed / 10}BB`;

  return {
    game: { ...game, players, pot: 0, currentBet: 0, actor: null, street: "complete",
      winner: winners.length === 1 ? { seat: winners[0]!, amount: payouts.get(winners[0]!) ?? 0 } : null, message },
    winners, hands,
  };
}
