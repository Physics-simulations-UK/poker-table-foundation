import { createFileRoute } from "@tanstack/react-router";
import { PokerTable } from "@/components/poker-table";
import { createHand } from "@/lib/poker";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Poker Coach | Six-Seat Table" },
    { name: "description", content: "Deal a six-player Texas Hold’em hand and reveal the community cards at the Poker Coach table." },
    { property: "og:title", content: "Poker Coach | Six-Seat Table" },
    { property: "og:description", content: "A six-player Texas Hold’em table with live card dealing and community card reveals." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: () => createHand(),
  component: Index,
});

function Index() {
  const initialGame = Route.useLoaderData();
  return <PokerTable initialGame={initialGame} />;
}
