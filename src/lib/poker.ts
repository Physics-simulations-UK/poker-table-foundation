import { BIG_BLIND, CHIPS_PER_BB, postBlinds, startBettingRound } from "@/lib/betting";

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank = "A" | "K" | "Q" | "J" | "10" | "9" | "8" | "7" | "6" | "5" | "4" | "3" | "2";
export type Position = "UTG" | "HJ" | "CO" | "BTN" | "SB" | "BB";
export type Street = "preflop" | "flop" | "turn" | "river" | "complete";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export interface Player {
  id: string;
  name: string;
  /** Chips behind, in tenths of a BB. */
  stack: number;
  position: Position;
  cards: [Card, Card];
  isHero: boolean;
  isDealer: boolean;
  folded: boolean;
  allIn: boolean;
  /** Contribution to the current betting round. */
  streetBet: number;
  /** Total contribution to the pot this hand. */
  totalCommitted: number;
  hasActed: boolean;
  lastAction: string | null;
}

export type HandActionType = "fold" | "check" | "call" | "raise";

export interface HandAction {
  street: Street;
  seat: number;
  position: Position;
  type: HandActionType;
  /** Chips added by this action. */
  amount: number;
  /** Player total bet on this street after the action. */
  to: number;
  /** Pot size immediately before the action. */
  potBefore: number;
}

export interface GameState {
  players: Player[];
  communityCards: [Card, Card, Card, Card, Card];
  revealedCount: 0 | 3 | 4 | 5;
  dealerSeat: number;
  handNumber: number;
  street: Street;
  /** Chips collected from completed streets. */
  pot: number;
  currentBet: number;
  minRaise: number;
  actor: number | null;
  winner: { seat: number; amount: number } | null;
  message: string | null;
  /** Ordered voluntary actions for this hand; forced blinds are omitted. */
  actionHistory: HandAction[];
}

const suits: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const ranks: Rank[] = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const clockwisePositions: Position[] = ["BTN", "SB", "BB", "UTG", "HJ", "CO"];
const seatNames = ["You", "Alex", "Morgan", "Sam", "Jordan", "Taylor"];
export const STARTING_STACK = 100 * CHIPS_PER_BB;

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

export function createHand(dealerSeat = 4, handNumber = 1, stacks?: number[]): GameState {
  const deck = shuffleDeck(createDeck());
  let next = 0;
  const draw = (): Card => {
    const card = deck[next++];
    if (!card) throw new Error("Deck ran out of cards");
    return card;
  };
  const players: Player[] = seatNames.map((name, seat) => {
    const carried = stacks?.[seat] ?? STARTING_STACK;
    return {
      id: `seat-${seat}`,
      name,
      // Busted players rebuy so the table always has six funded seats.
      stack: carried < BIG_BLIND ? STARTING_STACK : carried,
      position: clockwisePositions[(seat - dealerSeat + 6) % 6] ?? "BTN",
      cards: [draw(), draw()],
      isHero: seat === 0,
      isDealer: seat === dealerSeat,
      folded: false,
      allIn: false,
      streetBet: 0,
      totalCommitted: 0,
      hasActed: false,
      lastAction: null,
    };
  });
  const communityCards: GameState["communityCards"] = [draw(), draw(), draw(), draw(), draw()];
  const base: GameState = {
    players, communityCards, revealedCount: 0, dealerSeat, handNumber,
    street: "preflop", pot: 0, currentBet: 0, minRaise: BIG_BLIND, actor: null, winner: null, message: null, actionHistory: [],
  };
  return postBlinds(startBettingRound(base, "preflop", dealerSeat));
}

export function nextHand(game: GameState): GameState {
  return createHand((game.dealerSeat + 1) % 6, game.handNumber + 1, game.players.map((p) => p.stack));
}
