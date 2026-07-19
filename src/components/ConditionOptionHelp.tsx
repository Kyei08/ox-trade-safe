import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  name: string;
  description?: string | null;
  examples?: string | null;
  /** Visual size — matches the pill size in the surrounding chip. */
  size?: "sm" | "md";
}

/**
 * Small "?" affordance shown beside a condition option. Opens a popover with
 * a short description and example items so buyers and sellers share the same
 * expectations for what each condition means.
 *
 * Renders nothing when both description and examples are empty.
 */
export default function ConditionOptionHelp({
  name,
  description,
  examples,
  size = "md",
}: Props) {
  const desc = description?.trim();
  const ex = examples?.trim();
  if (!desc && !ex) return null;

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`What does "${name}" mean?`}
          className="inline-flex items-center justify-center rounded-full text-current/70 hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <HelpCircle className={iconSize} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-64 text-sm space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="font-semibold text-foreground">{name}</div>
        {desc && (
          <p className="text-muted-foreground leading-snug whitespace-pre-wrap">
            {desc}
          </p>
        )}
        {ex && (
          <div className="pt-1 border-t border-border/60">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
              Examples
            </div>
            <p className="text-foreground/90 leading-snug whitespace-pre-wrap">
              {ex}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
