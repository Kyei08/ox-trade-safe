import { trackEvent } from "@/lib/analytics";

/**
 * Tracks engagement with the condition option help popovers/drawers so we can
 * see (a) which options users need explained and (b) whether reading the help
 * leads them to actually pick (or filter by) that option.
 */

interface HelpSession {
  /** Correlates open/close/proceed events for a single option. */
  helpSessionId: string;
  /** How many times this option's help has been opened in this page session. */
  openCount: number;
  /** Total ms the help was open. */
  totalReadMs: number;
  /** Surface the help was last opened from. */
  surface: string;
  /** Whether a proceed event has already been emitted for this session. */
  proceeded: boolean;
}

const sessions = new Map<string, HelpSession>();

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export interface ConditionHelpContext {
  /** Where the help was rendered: "create_listing" | "browse_filters" | ... */
  surface: string;
  optionId: string;
  optionName: string;
  groupId?: string | null;
  groupName?: string | null;
  categoryId?: string | null;
  /** Presentation used: drawer on mobile, popover on desktop. */
  presentation?: "drawer" | "popover";
}

/** Call when the help popover/drawer opens. Returns the session id. */
export function trackConditionHelpOpened(ctx: ConditionHelpContext): string {
  const existing = sessions.get(ctx.optionId);
  const session: HelpSession = existing
    ? { ...existing, openCount: existing.openCount + 1, surface: ctx.surface }
    : {
        helpSessionId: newId(),
        openCount: 1,
        totalReadMs: 0,
        surface: ctx.surface,
        proceeded: false,
      };
  sessions.set(ctx.optionId, session);

  trackEvent("condition_help_opened", {
    help_session_id: session.helpSessionId,
    open_count: session.openCount,
    surface: ctx.surface,
    presentation: ctx.presentation ?? "popover",
    option_id: ctx.optionId,
    option_name: ctx.optionName,
    group_id: ctx.groupId ?? null,
    group_name: ctx.groupName ?? null,
    category_id: ctx.categoryId ?? null,
  });

  return session.helpSessionId;
}

/** Call when the help popover/drawer closes. `readMs` is time it stayed open. */
export function trackConditionHelpClosed(
  ctx: ConditionHelpContext,
  readMs: number
) {
  const session = sessions.get(ctx.optionId);
  if (!session) return;
  session.totalReadMs += Math.max(0, Math.round(readMs));

  trackEvent("condition_help_closed", {
    help_session_id: session.helpSessionId,
    surface: ctx.surface,
    presentation: ctx.presentation ?? "popover",
    option_id: ctx.optionId,
    option_name: ctx.optionName,
    category_id: ctx.categoryId ?? null,
    read_ms: Math.max(0, Math.round(readMs)),
    total_read_ms: session.totalReadMs,
    open_count: session.openCount,
  });
}

/**
 * Call when a user selects / applies a condition option. Emits a "proceeded"
 * event only when that option's help was read first (once per session), so we
 * can measure help → action conversion.
 */
export function trackConditionHelpProceeded(params: {
  surface: string;
  optionId: string;
  optionName: string;
  categoryId?: string | null;
  /** "selected" on the listing form, "filter_applied" in browse. */
  action: string;
}) {
  const session = sessions.get(params.optionId);
  if (!session || session.proceeded) return;
  session.proceeded = true;

  trackEvent("condition_help_proceeded", {
    help_session_id: session.helpSessionId,
    surface: params.surface,
    action: params.action,
    option_id: params.optionId,
    option_name: params.optionName,
    category_id: params.categoryId ?? null,
    open_count: session.openCount,
    total_read_ms: session.totalReadMs,
  });
}

/** True when the user has opened help for this option in this page session. */
export function hasReadConditionHelp(optionId: string) {
  return sessions.has(optionId);
}
