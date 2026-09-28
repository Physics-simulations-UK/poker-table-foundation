import { blendStrategies, type StrategyDistribution } from "@/lib/mixed-strategy";

export type RiverFacingBetAction = "fold" | "call" | "raise";

/**
 * Blend an existing river strategy with exact equity versus the represented
 * opponent range. Close decisions stay mixed; large equity edges shift more.
 */
export function equityAdjustedRiverStrategy(
  baseline:StrategyDistribution<RiverFacingBetAction>,
  equity:number,
  potOdds:number,
):Record<RiverFacingBetAction,number> {
  const edge=equity-potOdds;
  if(Math.abs(edge)<0.03) return blendStrategies(baseline,baseline,0);

  if(edge<=-0.18) return blendStrategies(baseline,{fold:.92,call:.08,raise:0},.75);
  if(edge<0) return blendStrategies(baseline,{fold:.72,call:.28,raise:0},.55);
  if(edge>=.35) return blendStrategies(baseline,{fold:.01,call:.44,raise:.55},.65);
  if(edge>=.15) return blendStrategies(baseline,{fold:.03,call:.67,raise:.30},.50);
  return blendStrategies(baseline,{fold:.12,call:.78,raise:.10},.35);
}
