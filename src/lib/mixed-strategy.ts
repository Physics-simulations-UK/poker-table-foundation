export type StrategyDistribution<Action extends string> = Partial<Record<Action, number>>;

export interface StrategyChoice<Action extends string> {
  action: Action;
  probability: number;
  distribution: Record<Action, number>;
}

export function normalizeStrategy<Action extends string>(
  distribution: StrategyDistribution<Action>,
): Record<Action, number> {
  const entries = Object.entries(distribution) as [Action, number][];
  if (entries.length === 0) throw new Error("Strategy distribution cannot be empty");
  for (const [, weight] of entries) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("Strategy weights must be finite and non-negative");
    }
  }
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) throw new Error("Strategy distribution must contain positive weight");

  const normalized = entries.map(([action, weight], index) => {
    if (index === entries.length - 1) return [action, 0] as [Action, number];
    return [action, weight / total] as [Action, number];
  });

  const used = normalized.slice(0, -1).reduce((sum, [, probability]) => sum + probability, 0);
  normalized[normalized.length - 1]![1] = Math.max(0, 1 - used);

  return Object.fromEntries(normalized) as Record<Action, number>;
}

export function chooseMixedAction<Action extends string>(
  distribution: StrategyDistribution<Action>,
  roll: number = Math.random(),
): StrategyChoice<Action> {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error("Strategy roll must be in the range 0 <= roll < 1");
  }

  const normalized = normalizeStrategy(distribution);
  const entries = Object.entries(normalized) as [Action, number][];
  let cumulative = 0;

  for (const [action, probability] of entries) {
    cumulative += probability;
    if (roll < cumulative) return { action, probability, distribution: normalized };
  }

  const [action, probability] = entries[entries.length - 1]!;
  return { action, probability, distribution: normalized };
}

export function blendStrategies<Action extends string>(
  baseline: StrategyDistribution<Action>,
  adjustment: StrategyDistribution<Action>,
  adjustmentWeight: number,
): Record<Action, number> {
  if (adjustmentWeight < 0 || adjustmentWeight > 1) {
    throw new Error("Adjustment weight must be between 0 and 1");
  }
  const base = normalizeStrategy(baseline);
  const adj = normalizeStrategy(adjustment);
  const actions = new Set<Action>([
    ...(Object.keys(base) as Action[]),
    ...(Object.keys(adj) as Action[]),
  ]);
  const mixed: StrategyDistribution<Action> = {};
  for (const action of actions) {
    mixed[action] =
      (base[action] ?? 0) * (1 - adjustmentWeight) +
      (adj[action] ?? 0) * adjustmentWeight;
  }
  return normalizeStrategy(mixed);
}
