export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
export type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface Player {
  id: string;
  name: string;
  stackBB: number;
  position: Position;
  cards: [Card, Card];
  isHero: boolean;
  isDealer: boolean;
}

export interface GameState {
  players: Player[];
  communityCards: [Card, Card, Card, Card, Card];
  revealedCount: 0 | 3 | 4 | 5;
  dealerSeat: number;
  handNumber: number;
}

const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const ranks: Rank[] = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const clockwisePositions: Position[] = ["BTN", "SB", "BB", "UTG", "HJ", "CO"];
const seatNames = ["You", "Alex", "Morgan", "Sam", "Jordan", "Taylor"];

export function createDeck(): Card[] {
  return suits.flatMap((suit) => ranks.map((rank) => ({ rank, suit })));
}

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const j = (random[0] ?? 0) % (i + 1);
    const current = shuffled[i];
    const swap = shuffled[j];
    if (!current || !swap) throw new Error("Invalid deck while shuffling");
    [shuffled[i], shuffled[j]] = [swap, current];
  }
  return shuffled;
}

export function createHand(dealerSeat = 4, handNumber = 1): GameState {
  const deck = shuffleDeck(createDeck());
  let next = 0;
  const draw = (): Card => {
    const card = deck[next++];
    if (!card) throw new Error("Deck ran out of cards");
    return card;
  };
  const players: Player[] = seatNames.map((name, seat) => ({
    id: `seat-${seat}`,
    name,
    stackBB: 100,
    position: clockwisePositions[(seat - dealerSeat + 6) % 6] ?? "BTN",
    cards: [draw(), draw()],
    isHero: seat === 0,
    isDealer: seat === dealerSeat,
  }));
  const communityCards: GameState["communityCards"] = [
    draw(), draw(), draw(), draw(), draw(),
  ];
  return { players, communityCards, revealedCount: 0, dealerSeat, handNumber };
}

export function nextHand(game: GameState): GameState {
  return createHand((game.dealerSeat + 1) % 6, game.handNumber + 1);
}

export function revealStreet(game: GameState, street: "flop" | "turn" | "river"): GameState {
  const count = { flop: 3, turn: 4, river: 5 }[street] as 3 | 4 | 5;
  // Streets must be revealed in order; repeated clicks do nothing.
  if (count !== game.revealedCount + (game.revealedCount === 0 ? 3 : 1)) return game;
  return { ...game, revealedCount: count };
}
