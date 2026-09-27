# Poker Table Foundation

Create the first version of a web application called Poker Coach.

This request is ONLY for the poker table interface and basic card dealing. Do not build coaching, statistics, training modules, authentication, databases, APIs or advanced poker strategy yet.

The objective of this generation is to produce a small, working foundation that we will extend incrementally.

Poker table

Create a polished 6-player No-Limit Texas Hold’em table.

Use React and TypeScript.

The table should dominate the screen and be designed primarily for desktop and tablet landscape.

Use a dark professional poker-room aesthetic:

* dark background
* dark green oval poker table
* six clearly positioned player seats
* clean typography
* subtle gold accents
* professional-looking playing cards

Do not make it look like a generic SaaS dashboard.

Players

Place six players around the table.

Hero should be centred at the bottom.

Each player should display:

* player name
* chip stack in BB
* position
* dealer button where appropriate

Positions:

UTG
HJ
CO
BTN
SB
BB

All players start with 100BB.

Hero’s cards should be clearly visible.

Opponent cards should be face down.

Basic poker state

Implement only enough deterministic TypeScript logic to:

1. Create a standard 52-card deck.
2. Shuffle the deck.
3. Deal two unique cards to each player.
4. Display Hero’s cards face up.
5. Display opponents’ cards face down.
6. Assign the six positions correctly.
7. Display a dealer button.
8. Provide a “New Hand” button.
9. When New Hand is pressed:
    * create and shuffle a new deck
    * deal new unique cards
    * rotate the dealer/positions one seat clockwise

Also deal five unique community cards internally.

For development/testing, include four temporary buttons:

SHOW FLOP
SHOW TURN
SHOW RIVER
NEW HAND

SHOW FLOP reveals the first three community cards.

SHOW TURN reveals the fourth.

SHOW RIVER reveals the fifth.

No card may appear twice anywhere in the hand.

Architecture

Keep poker state and deck logic separate from visual components.

Create reusable TypeScript types for:

Card
Player
GameState

Do not implement:

* betting
* computer opponent decisions
* hand evaluation
* poker coaching
* GTO strategy
* statistics
* hand history
* Supabase
* authentication
* AI APIs

We will add these later.

Definition of done

Do not add extra features.

The task is complete when I can open the app and:

* see a professional six-seat poker table
* see Hero’s two cards
* see five opponents with hidden cards
* reveal flop, turn and river
* deal a new hand
* see positions rotate
* never see duplicate cards

Prioritise reliable functionality over additional features.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a447c1ff-0624-483b-8707-245ecbefb2a8).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
