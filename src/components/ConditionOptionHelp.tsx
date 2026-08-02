import { HelpCircle } from "lucide-react";
import { useRef, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  trackConditionHelpClosed,
  trackConditionHelpOpened,
} from "@/lib/conditionHelpAnalytics";
import type { ConditionHelpVariant } from "@/lib/conditionHelpExperiment";

interface Props {
  name: string;
  description?: string | null;
  examples?: string | null;
  /** Visual size — matches the pill size in the surrounding chip. */
  size?: "sm" | "md";
  /** Analytics context. */
  surface?: string;
  optionId?: string;
  groupId?: string | null;
  groupName?: string | null;
  categoryId?: string | null;
  /** A/B copy variant currently rendered. */
  variant?: ConditionHelpVariant;
  inExperiment?: boolean;
}


/**
 * Small "?" affordance shown beside a condition option.
 *
 * Desktop: hover/click popover anchored to the chip.
 * Mobile: tap opens a bottom drawer (larger touch target, no clipping inside
 * horizontally scrolling chip rows) and tapping outside or the overlay dismisses it.
 *
 * Renders nothing when both description and examples are empty.
 */
export default function ConditionOptionHelp({
  name,
  description,
  examples,
  size = "md",
  surface = "unknown",
  optionId,
  groupId,
  groupName,
  categoryId,
  variant = "A",
  inExperiment = false,
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const openedAtRef = useRef<number | null>(null);

  const desc = description?.trim();
  const ex = examples?.trim();

  const analyticsCtx = {
    surface,
    optionId: optionId || name,
    optionName: name,
    groupId,
    groupName,
    categoryId,
    presentation: (isMobile ? "drawer" : "popover") as "drawer" | "popover",
    variant,
    inExperiment,
  };


  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      openedAtRef.current = Date.now();
      trackConditionHelpOpened(analyticsCtx);
    } else {
      const startedAt = openedAtRef.current;
      openedAtRef.current = null;
      trackConditionHelpClosed(analyticsCtx, startedAt ? Date.now() - startedAt : 0);
    }
  };

  if (!desc && !ex) return null;

  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  const trigger = (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (isMobile) handleOpenChange(true);
      }}
      onPointerDown={stop}
      aria-label={`What does "${name}" mean?`}
      className={`inline-flex items-center justify-center rounded-full text-current/70 hover:text-current focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isMobile ? "min-w-[44px] min-h-[44px] -my-2 -mr-1" : ""
      }`}
    >
      <HelpCircle className={isMobile ? "w-4 h-4" : iconSize} aria-hidden />
    </button>
  );

  const body = (
    <>
      {desc && (
        <p className="text-muted-foreground leading-snug whitespace-pre-wrap">
          {desc}
        </p>
      )}
      {ex && (
        <div className="pt-2 mt-2 border-t border-border/60">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
            Examples
          </div>
          <p className="text-foreground/90 leading-snug whitespace-pre-wrap">
            {ex}
          </p>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={handleOpenChange}>
          <DrawerContent onClick={stop}>
            <DrawerHeader className="text-left">
              <DrawerTitle>{name}</DrawerTitle>
              <DrawerDescription className="sr-only">
                Condition option details
              </DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-2 text-sm">{body}</div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline" className="w-full">
                  Got it
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        collisionPadding={12}
        className="w-64 text-sm space-y-2"
        onClick={stop}
      >
        <div className="font-semibold text-foreground">{name}</div>
        {body}
      </PopoverContent>
    </Popover>
  );
}
