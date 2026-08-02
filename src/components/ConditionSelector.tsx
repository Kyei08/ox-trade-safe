import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Loader2, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import ConditionOptionHelp from "@/components/ConditionOptionHelp";
import { trackConditionHelpProceeded } from "@/lib/conditionHelpAnalytics";

interface ConditionOption {
  id: string;
  group_id: string;
  name: string;
  slug: string;
  sort_order: number;
  description?: string | null;
  examples?: string | null;
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
    if (!user) return;
    let cancelled = false;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin" })
      .then(({ data, error }) => {
        if (cancelled) return;
        setIsAdmin(!!data && !error);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

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
          .select("id, group_id, name, slug, sort_order, description, examples")
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
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground space-y-3">
        <p>No condition options have been configured for this category yet.</p>
        {isAdmin && (
          <Button asChild variant="outline" size="sm">
            <Link to="/admin/categories" className="inline-flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Configure category conditions
            </Link>
          </Button>
        )}
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
                const hasHelp = !!(opt.description?.trim() || opt.examples?.trim());
                return (
                  <div
                    key={opt.id}
                    className={`inline-flex items-center gap-1 rounded-full border transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground border-border hover:bg-muted"
                    } ${hasHelp ? "pr-2" : ""}`}
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        if (!active) {
                          trackConditionHelpProceeded({
                            surface: "create_listing",
                            optionId: opt.id,
                            optionName: opt.name,
                            categoryId,
                            action: "selected",
                          });
                        }
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
                        );
                      }}
                      className="px-3.5 py-1.5 rounded-full text-sm font-medium bg-transparent"
                    >
                      {opt.name}
                    </button>
                    {hasHelp && (
                      <ConditionOptionHelp
                        name={opt.name}
                        description={opt.description}
                        examples={opt.examples}
                        surface="create_listing"
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
      <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">
        Select exactly one condition that best describes your item.
      </p>
    </div>
  );
};

export default ConditionSelector;
