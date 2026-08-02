import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ConditionOptionHelp from "@/components/ConditionOptionHelp";
import { trackConditionHelpProceeded } from "@/lib/conditionHelpAnalytics";
import { resolveConditionHelp } from "@/lib/conditionHelpExperiment";

interface ConditionOption {
  id: string;
  group_id: string;
  name: string;
  slug: string;
  sort_order: number;
  description?: string | null;
  examples?: string | null;
  description_b?: string | null;
  examples_b?: string | null;
  help_experiment_enabled?: boolean | null;
}


interface ConditionGroup {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_multi_select: boolean;
  options: ConditionOption[];
}

interface Props {
  categoryId: string | null;
  selectedOptionIds: string[];
  onToggle: (optionId: string, context?: { isMultiSelect: boolean; siblingIds: string[] }) => void;
}

const DynamicConditionFilters = ({ categoryId, selectedOptionIds, onToggle }: Props) => {
  const [groups, setGroups] = useState<ConditionGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!categoryId || categoryId === "all") {
      setGroups([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: g } = await supabase
        .from("category_condition_groups")
        .select("id, category_id, name, icon, sort_order, is_multi_select")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: true });

      const groupIds = (g || []).map((x) => x.id);
      let opts: ConditionOption[] = [];
      if (groupIds.length) {
        const { data: o } = await supabase
          .from("category_condition_options")
          .select(
            "id, group_id, name, slug, sort_order, description, examples, description_b, examples_b, help_experiment_enabled"
          )

          .in("group_id", groupIds)
          .order("sort_order", { ascending: true });
        opts = o || [];
      }
      if (cancelled) return;
      setGroups(
        (g || []).map((grp) => ({
          ...grp,
          options: opts.filter((o) => o.group_id === grp.id),
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  if (!categoryId || categoryId === "all" || groups.length === 0) return null;

  return (
    <div className="space-y-2 pt-1">
      {groups.map((group) => {
        if (group.options.length === 0) return null;
        const Icon = (group.icon && (LucideIcons as any)[group.icon]) as LucideIcon | undefined;
        return (
          <div key={group.id} className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 min-w-[120px] text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
              <span>{group.name}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {group.options.map((opt) => {
                const active = selectedOptionIds.includes(opt.id);
                const siblingIds = group.options.map((o) => o.id);
                const help = resolveConditionHelp(opt);
                const hasHelp = help.hasHelp;

                return (
                  <div
                    key={opt.id}
                    className={`inline-flex items-center gap-1 rounded-full border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-muted"
                    } ${hasHelp ? "pr-1.5" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!active) {
                          trackConditionHelpProceeded({
                            surface: "browse_filters",
                            optionId: opt.id,
                            optionName: opt.name,
                            categoryId,
                            action: "filter_applied",
                          });
                        }
                        onToggle(opt.id, {
                          isMultiSelect: group.is_multi_select,
                          siblingIds,
                        });
                      }}
                      className="px-3 py-1.5 rounded-full text-xs font-medium bg-transparent"
                    >
                      {opt.name}
                    </button>
                    {hasHelp && (
                      <ConditionOptionHelp
                        name={opt.name}
                        description={help.description}
                        examples={help.examples}
                        variant={help.variant}
                        inExperiment={help.inExperiment}
                        size="sm"

                        surface="browse_filters"
                        optionId={opt.id}
                        groupId={group.id}
                        groupName={group.name}
                        categoryId={categoryId}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DynamicConditionFilters;
