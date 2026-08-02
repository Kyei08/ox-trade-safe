/**
 * A/B testing for condition help content.
 *
 * Each condition option can carry a second variation of its help copy
 * (`description_b` / `examples_b`). When `help_experiment_enabled` is true, a
 * visitor is deterministically bucketed into variant "A" or "B" per option, so
 * the same person always sees the same copy and the resulting
 * `help_session_id` correlation stays clean.
 */

export type ConditionHelpVariant = "A" | "B";

const VISITOR_KEY = "ox_help_experiment_visitor";

/** Stable per-browser id used as the bucketing seed. */
export function getExperimentVisitorId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return "anonymous";
  }
}

/** Cheap deterministic 32-bit string hash (FNV-1a). */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Bucket a visitor into A/B for a given option (50/50 split). */
export function assignVariant(optionId: string, visitorId = getExperimentVisitorId()): ConditionHelpVariant {
  return hash(`${visitorId}:${optionId}`) % 2 === 0 ? "A" : "B";
}

export interface ConditionHelpContent {
  id: string;
  description?: string | null;
  examples?: string | null;
  description_b?: string | null;
  examples_b?: string | null;
  help_experiment_enabled?: boolean | null;
}

export interface ResolvedConditionHelp {
  description: string | null;
  examples: string | null;
  variant: ConditionHelpVariant;
  /** True when this option is actively running an A/B test. */
  inExperiment: boolean;
  hasHelp: boolean;
}

/**
 * Resolve which help copy to show for an option. Falls back to variant A copy
 * when the experiment is off or when the B copy is empty.
 */
export function resolveConditionHelp(option: ConditionHelpContent): ResolvedConditionHelp {
  const aDesc = option.description?.trim() || null;
  const aEx = option.examples?.trim() || null;
  const bDesc = option.description_b?.trim() || null;
  const bEx = option.examples_b?.trim() || null;

  const canRun = !!option.help_experiment_enabled && !!(bDesc || bEx);
  const variant: ConditionHelpVariant = canRun ? assignVariant(option.id) : "A";
  const useB = canRun && variant === "B";

  const description = useB ? bDesc ?? aDesc : aDesc;
  const examples = useB ? bEx ?? aEx : aEx;

  return {
    description,
    examples,
    variant,
    inExperiment: canRun,
    hasHelp: !!(description || examples),
  };
}
