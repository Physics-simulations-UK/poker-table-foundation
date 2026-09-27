<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep pure poker deck and hand-state logic in `src/lib/poker.ts`, separate from table presentation, so future game rules can be added without coupling to rendering.
- Initialize the first shuffled hand in the index route loader so server and browser hydrate the same cards.
- Betting engine lives in `src/lib/betting.ts` (street-agnostic, chips as integer tenths of a BB) and bot decisions in `src/lib/bot.ts`, so later streets reuse one engine without float drift.
