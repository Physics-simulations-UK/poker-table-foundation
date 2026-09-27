import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { nextHand, type Card, type GameState, type Player } from "@/lib/poker";
import { applyAction, CHIPS_PER_BB, formatBB, getLegalActions, potTotal, toBB, type BetAction } from "@/lib/betting";
import { decideBotAction } from "@/lib/bot";

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

function Seat({ player, seat, active, showdown }: { player: Player; seat: number; active: boolean; showdown: boolean }) {
  return (
    <div className={`seat seat-${seat} ${player.isHero ? "seat-hero" : ""} ${player.folded ? "seat-folded" : ""} ${active ? "seat-active" : ""}`}>
      <div className="seat-cards" aria-label={player.isHero ? "Your hole cards" : `${player.name}'s hidden cards`}>
        {player.cards.map((card, index) => <PlayingCard key={index} card={card} hidden={!player.isHero && !(showdown && !player.folded)} />)}
      </div>
      <div className="seat-info">
        <div className="seat-top">
          <span className="seat-position">{player.position}</span>
          {player.lastAction && <span className="seat-action">{player.lastAction}</span>}
        </div>
        <div className="seat-details"><span className="seat-name">{player.name}</span><span className="seat-stack">{toBB(player.stack)} <small>BB</small></span></div>
        {player.isDealer && <span className="dealer-button" aria-label="Dealer button">D</span>}
      </div>
      {player.streetBet > 0 && <span className="seat-bet" aria-label={`${player.name} has bet ${formatBB(player.streetBet)}`}>{toBB(player.streetBet)} <small>BB</small></span>}
    </div>
  );
}

function HeroControls({ game, onAction }: { game: GameState; onAction: (a: BetAction) => void }) {
  const legal = getLegalActions(game);
  const [raiseBB, setRaiseBB] = useState(0);
  const minBB = legal ? toBB(legal.minRaiseTo) : 0;
  const maxBB = legal ? toBB(legal.maxRaiseTo) : 0;
  useEffect(() => { setRaiseBB(minBB); }, [minBB, game.actor, game.currentBet]);
  if (!legal) return null;
  const clamp = (bb: number) => Math.min(maxBB, Math.max(minBB, Math.round(bb * 10) / 10));
  const quick = [2.5, 3, 4].filter((bb) => bb * CHIPS_PER_BB >= legal.minRaiseTo && bb * CHIPS_PER_BB <= legal.maxRaiseTo);
  const raiseTo = clamp(raiseBB || minBB);
  return (
    <div className="hero-controls" aria-label="Your action">
      <div className="hero-raise">
        <span className="control-overline">RAISE TO</span>
        {legal.canRaise && <>
          <div className="hero-quick">
            {quick.map((bb) => <Button key={bb} variant="tableOutline" size="sm" onClick={() => setRaiseBB(bb)}>{bb}BB</Button>)}
            <Button variant="tableOutline" size="sm" onClick={() => setRaiseBB(maxBB)}>ALL-IN</Button>
          </div>
          <div className="hero-slider">
            <input type="range" min={minBB} max={maxBB} step={0.5} value={raiseTo} onChange={(e) => setRaiseBB(Number(e.target.value))} aria-label="Raise amount slider" />
            <input type="number" min={minBB} max={maxBB} step={0.5} value={raiseBB} onChange={(e) => setRaiseBB(Number(e.target.value))} onBlur={() => setRaiseBB(clamp(raiseBB))} aria-label="Raise amount in big blinds" />
          </div>
        </>}
      </div>
      <div className="control-actions">
        {legal.canFold && <Button variant="tableOutline" onClick={() => onAction({ type: "fold" })}>FOLD</Button>}
        {legal.canCheck && <Button variant="tableOutline" onClick={() => onAction({ type: "check" })}>CHECK</Button>}
        {legal.canCall && <Button variant="tableOutline" onClick={() => onAction({ type: "call" })}>CALL {formatBB(legal.callAmount)}</Button>}
        {legal.canRaise && <Button variant="table" onClick={() => onAction({ type: "raise", to: Math.round(raiseTo * CHIPS_PER_BB) })}>{raiseTo * CHIPS_PER_BB >= legal.maxRaiseTo ? "ALL-IN" : "RAISE TO"} {raiseTo}BB</Button>}
      </div>
    </div>
  );
}

export function PokerTable({ initialGame }: { initialGame: GameState }) {
  const [game, setGame] = useState(initialGame);
  const tableScroll = useRef<HTMLDivElement>(null);
  const [tableScale, setTableScale] = useState(1);

  // Scale the fixed logical poker-table canvas to the actual space available.
  // This is viewport/container driven rather than tied to any particular device.
  useLayoutEffect(() => {
    const element = tableScroll.current;
    if (!element) return;

    const updateScale = () => {
      if (window.innerWidth <= 800) {
        setTableScale(1);
        return;
      }
      const widthScale = element.clientWidth / 1100;
      const heightScale = element.clientHeight / 690;
      setTableScale(Math.min(1.08, widthScale, heightScale));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(element);
    window.addEventListener("resize", updateScale);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);
  useEffect(() => {
    const element = tableScroll.current;
    if (element && window.innerWidth <= 800) element.scrollLeft = (element.scrollWidth - element.clientWidth) / 2;
  }, []);

  const actor = game.actor === null ? undefined : game.players[game.actor];
  const heroTurn = !!actor?.isHero;

  // Computer opponents act after a short delay so the action is easy to follow.
  useEffect(() => {
    if (!actor || actor.isHero) return;
    const seat = game.actor;
    const timer = window.setTimeout(() => {
      setGame((g) => (g.actor === seat ? applyAction(g, decideBotAction(g)) : g));
    }, 450 + Math.floor(Math.random() * 350));
    return () => window.clearTimeout(timer);
  }, [game, actor]);

  return (
    <main className="poker-app">
      <header className="app-header">
        <div className="brand"><span className="brand-mark">♠</span><span>POKER <strong>COACH</strong></span></div>
        <div className="header-meta"><span className="status-dot" /> 6-MAX <span className="meta-divider" /> NO-LIMIT HOLD’EM</div>
      </header>

      <section className="game-area" aria-label="Poker table">
        <div className="table-heading"><span>THE TABLE <span className="heading-line" /></span><span>HAND {String(game.handNumber).padStart(2, "0")} <span className="heading-separator">/</span> {game.street.toUpperCase()}</span></div>
        <div className="table-scroll" ref={tableScroll}>
          <div
            className="table-stage"
            style={{ transform: `translateX(-50%) scale(${tableScale})` }}
          >
            <div className="table-outer"><div className="table-rail"><div className="table-felt">
              <div className="felt-border" />
              <div className="felt-brand"><span className="felt-brand-symbol">♠</span><span>POKER COACH</span></div>
              <div className="table-pot" aria-label="Pot"><span>POT</span><strong>{toBB(potTotal(game))} <small>BB</small></strong></div>
              <div className="community-cards" aria-label="Community cards">
                {game.communityCards.map((card, i) => <PlayingCard key={i} card={i < game.revealedCount ? card : undefined} small />)}
              </div>
              {game.message ? <div className="table-message" role="status">{game.message}</div> : <div className="table-label">NO LIMIT · TEXAS HOLD’EM</div>}
            </div></div></div>
            {game.players.map((player, index) => <Seat key={player.id} player={player} seat={index} active={game.actor === index} showdown={game.street === "complete" && game.revealedCount === 5} />)}
          </div>
        </div>
      </section>

      <div className="control-bar">
        <div className="control-caption">
          <span className="control-overline">{heroTurn ? "YOUR ACTION" : "TABLE CONTROLS"}</span>
          <span className="control-subtitle">
            {heroTurn ? "Your turn to act" : actor ? `${actor.name} is thinking…` : game.message ?? "Hand complete"}
          </span>
        </div>
        {heroTurn && <HeroControls game={game} onAction={(a) => setGame((g) => applyAction(g, a))} />}
        <div className="control-actions">
          <Button variant="tableOutline" disabled>SHOW TURN</Button>
          <Button variant="tableOutline" disabled>SHOW RIVER</Button>
          <span className="control-divider" />
          <Button variant="table" onClick={() => setGame((g) => nextHand(g))}><RotateCcw aria-hidden="true" /> NEW HAND</Button>
        </div>
      </div>
      <footer className="app-footer"><span>POKER COACH <span className="footer-separator">/</span> TABLE VIEW</span><span>6 PLAYERS <span className="footer-separator">·</span> 100 BB STARTING STACKS</span></footer>
    </main>
  );
}
