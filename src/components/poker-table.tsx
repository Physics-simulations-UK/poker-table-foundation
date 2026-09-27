import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextHand, revealStreet, type Card, type GameState, type Player } from "@/lib/poker";

const suitGlyph: Record<Card["suit"], string> = {
  spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣",
};

function PlayingCard({ card, hidden = false, small = false }: { card?: Card | undefined; hidden?: boolean; small?: boolean }) {
  if (hidden) {
    return <div className={`playing-card card-back ${small ? "card-small" : ""}`} aria-label="Face-down card"><span className="card-back-inner"><span>♠</span></span></div>;
  }
  if (!card) return <div className={`playing-card card-slot ${small ? "card-small" : ""}`} aria-label="Unrevealed community card"><span>✦</span></div>;
  return (
    <div className={`playing-card card-face suit-${card.suit} ${small ? "card-small" : ""}`} aria-label={`${card.rank} of ${card.suit}`}>
      <span className="card-corner"><b>{card.rank}</b><span>{suitGlyph[card.suit]}</span></span>
      <span className="card-center">{suitGlyph[card.suit]}</span>
      <span className="card-corner card-corner-bottom"><b>{card.rank}</b><span>{suitGlyph[card.suit]}</span></span>
    </div>
  );
}

function Seat({ player, seat }: { player: Player; seat: number }) {
  return (
    <div className={`seat seat-${seat} ${player.isHero ? "seat-hero" : ""}`}>
      <div className="seat-cards" aria-label={player.isHero ? "Your hole cards" : `${player.name}'s hidden cards`}>
        {player.cards.map((card, index) => <PlayingCard key={index} card={card} hidden={!player.isHero} />)}
      </div>
      <div className="seat-info">
        <span className="seat-position">{player.position}</span>
        <div className="seat-details"><span className="seat-name">{player.name}</span><span className="seat-stack">{player.stackBB} <small>BB</small></span></div>
        {player.isDealer && <span className="dealer-button" aria-label="Dealer button">D</span>}
      </div>
    </div>
  );
}

export function PokerTable({ initialGame }: { initialGame: GameState }) {
  const [game, setGame] = useState(initialGame);
  const tableScroll = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = tableScroll.current;
    if (element && window.innerWidth <= 800) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, []);
  return (
    <main className="poker-app">
      <header className="app-header">
        <div className="brand"><span className="brand-mark">♠</span><span>POKER <strong>COACH</strong></span></div>
        <div className="header-meta"><span className="status-dot" /> 6-MAX <span className="meta-divider" /> NO-LIMIT HOLD’EM</div>
      </header>

      <section className="game-area" aria-label="Poker table">
        <div className="table-heading"><span>THE TABLE <span className="heading-line" /></span><span>HAND {String(game.handNumber).padStart(2, "0")} <span className="heading-separator">/</span> 100 BB DEEP</span></div>
        <div className="table-scroll" ref={tableScroll}>
          <div className="table-stage">
            <div className="table-outer"><div className="table-rail"><div className="table-felt">
              <div className="felt-border" />
              <div className="felt-brand"><span className="felt-brand-symbol">♠</span><span>POKER COACH</span></div>
              <div className="community-cards" aria-label="Community cards">
                {game.communityCards.map((card, i) => <PlayingCard key={i} card={i < game.revealedCount ? card : undefined} small />)}
              </div>
              <div className="table-label">NO LIMIT · TEXAS HOLD’EM</div>
            </div></div></div>
            {game.players.map((player, index) => <Seat key={player.id} player={player} seat={index} />)}
          </div>
        </div>
      </section>

      <div className="control-bar">
        <div className="control-caption"><span className="control-overline">TABLE CONTROLS</span><span className="control-subtitle">Community cards</span></div>
        <div className="control-actions">
          <Button variant="tableOutline" disabled={game.revealedCount !== 0} onClick={() => setGame((g) => revealStreet(g, "flop"))}>SHOW FLOP</Button>
          <Button variant="tableOutline" disabled={game.revealedCount !== 3} onClick={() => setGame((g) => revealStreet(g, "turn"))}>SHOW TURN</Button>
          <Button variant="tableOutline" disabled={game.revealedCount !== 4} onClick={() => setGame((g) => revealStreet(g, "river"))}>SHOW RIVER</Button>
          <span className="control-divider" />
          <Button variant="table" onClick={() => setGame((g) => nextHand(g))}><RotateCcw aria-hidden="true" /> NEW HAND</Button>
        </div>
      </div>
      <footer className="app-footer"><span>POKER COACH <span className="footer-separator">/</span> TABLE VIEW</span><span>6 PLAYERS <span className="footer-separator">·</span> 100 BB STACKS</span></footer>
    </main>
  );
}
