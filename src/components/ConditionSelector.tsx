import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface ConditionOption {
  id: string;
  group_id: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface ConditionGroup {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  options: ConditionOption[];
}

export interface SelectedCondition {
  optionId: string;
  optionName: string;
  optionSlug: string;
  groupId: string;
  /** Category the option's group belongs to — used for client-side pre-validation. May be absent on legacy drafts. */
  groupCategoryId?: string;
}

interface Props {
  categoryId: string | null;
  value: string | null; // selected option id
  onChange: (selected: SelectedCondition | null) => void;
  onGroupsLoaded?: (hasGroups: boolean) => void;
}

const ConditionSelector = ({ categoryId, value, onChange, onGroupsLoaded }: Props) => {
  const { user } = useAuth();
  const [groups, setGroups] = useState<ConditionGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!categoryId) {
      setGroups([]);
      onGroupsLoaded?.(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: g } = await supabase
        .from("category_condition_groups")
        .select("id, category_id, name, icon, sort_order")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: true });

      const groupIds = (g || []).map((x) => x.id);
      let opts: ConditionOption[] = [];
      if (groupIds.length) {
        const { data: o } = await supabase
          .from("category_condition_options")
          .select("id, group_id, name, slug, sort_order")
          .in("group_id", groupIds)
          .order("sort_order", { ascending: true });
        opts = o || [];
      }
      if (cancelled) return;
      const next = (g || []).map((grp) => ({
        ...grp,
        options: opts.filter((o) => o.group_id === grp.id),
      }));
      setGroups(next);
      setLoading(false);
      onGroupsLoaded?.(next.some((grp) => grp.options.length > 0));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  if (!categoryId) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        Select a category to see available condition options.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading conditions…
      </div>
    );
  }

  if (groups.length === 0 || groups.every((g) => g.options.length === 0)) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        No condition options have been configured for this category yet.
      </div>
    );
  }

  return (
    <div
      key={categoryId}
      className="rounded-lg border border-border bg-card p-4 space-y-5 animate-fade-in"
    >
      {groups.map((group) => {
        if (group.options.length === 0) return null;
        const Icon = (group.icon && (LucideIcons as any)[group.icon]) as LucideIcon | undefined;
        return (
          <div key={group.id} className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
              {Icon ? <Icon className="w-3.5 h-3.5" /> : null}
              <span>{group.name}</span>
            </div>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {group.options.map((opt) => {
                const active = value === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      onChange(
                        active
                          ? null
                          : {
                              optionId: opt.id,
                              optionName: opt.name,
                              optionSlug: opt.slug,
                              groupId: group.id,
                              groupCategoryId: group.category_id,
                            }
                      )
                    }
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {opt.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
        Select exactly one condition that best describes your item.
      </p>
    </div>
  );
};

export default ConditionSelector;
