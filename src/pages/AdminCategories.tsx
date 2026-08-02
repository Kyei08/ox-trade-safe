import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Save,
  Tag,
  Trash2,
  X,
  icons as LucideIcons,
  HelpCircle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  sort_order: number;
}

interface ConditionGroup {
  id: string;
  category_id: string;
  name: string;
  icon: string | null;
  is_multi_select: boolean;
  sort_order: number;
}

interface ConditionOption {
  id: string;
  group_id: string;
  name: string;
  sort_order: number;
  description?: string | null;
  examples?: string | null;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Normalize a Lucide icon name to its PascalCase export (e.g. "refresh-cw" → "RefreshCw").
const toPascalIconName = (raw: string) =>
  raw
    .trim()
    .replace(/[_\s]+/g, "-")
    .split("-")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join("");

const resolveLucideIcon = (raw: string | null | undefined) => {
  if (!raw || !raw.trim()) return null;
  const map = LucideIcons as unknown as Record<string, React.ComponentType<any>>;
  // Try exact, then PascalCase normalization.
  if (map[raw]) return map[raw];
  const pascal = toPascalIconName(raw);
  return map[pascal] || null;
};

// All Lucide icon names (PascalCase), sorted once at module load.
const ALL_LUCIDE_ICON_NAMES: string[] = Object.keys(
  LucideIcons as unknown as Record<string, unknown>,
)
  .filter((k) => /^[A-Z]/.test(k))
  .sort();

const IconPicker = ({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (name: string | null) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const SelectedIcon = resolveLucideIcon(value);
  const q = query.trim().toLowerCase();
  const filtered = (q
    ? ALL_LUCIDE_ICON_NAMES.filter((n) => n.toLowerCase().includes(q))
    : ALL_LUCIDE_ICON_NAMES
  ).slice(0, 200);
  const map = LucideIcons as unknown as Record<string, React.ComponentType<any>>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 justify-start gap-2 font-normal"
          aria-label="Pick a Lucide icon"
        >
          {SelectedIcon ? (
            <SelectedIcon className="w-4 h-4" />
          ) : (
            <HelpCircle className="w-4 h-4 opacity-60" />
          )}
          <span className="truncate text-xs">
            {value || <span className="text-muted-foreground">Pick icon</span>}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <Input
          autoFocus
          placeholder="Search icons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="grid grid-cols-6 gap-1 max-h-64 overflow-y-auto">
          {filtered.map((name) => {
            const Cmp = map[name];
            const isActive = value === name;
            return (
              <button
                key={name}
                type="button"
                title={name}
                aria-label={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                }}
                className={`flex items-center justify-center h-9 w-9 rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${
                  isActive ? "border-primary text-foreground bg-muted" : "border-transparent"
                }`}
              >
                <Cmp className="w-4 h-4" />
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-6 text-xs text-muted-foreground p-2 text-center">
              No icons match "{query}".
            </p>
          )}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t">
          <span className="text-[10px] text-muted-foreground">
            Showing {filtered.length} of {ALL_LUCIDE_ICON_NAMES.length}
          </span>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const makeSubAnnouncements = (catName: string, subs: Subcategory[]) => ({
  onDragStart({ active }: { active: any }) {
    const name = active.data.current?.name || "Subcategory";
    return `Picked up subcategory ${name} in ${catName}. Press arrow keys to move, space or enter to drop, escape to cancel.`;
  },
  onDragOver({ active, over }: { active: any; over: any }) {
    const name = active.data.current?.name || "Subcategory";
    if (over) {
      const idx = subs.findIndex((s) => s.id === over.id) + 1;
      return `Moving subcategory ${name} to position ${idx} of ${subs.length} in ${catName}.`;
    }
    return `Moving subcategory ${name}.`;
  },
  onDragEnd({ active, over }: { active: any; over: any }) {
    const name = active.data.current?.name || "Subcategory";
    if (over) {
      const idx = subs.findIndex((s) => s.id === over.id) + 1;
      return `Dropped subcategory ${name} at position ${idx} of ${subs.length} in ${catName}.`;
    }
    return `Dropped subcategory ${name}.`;
  },
  onDragCancel({ active }: { active: any }) {
    const name = active.data.current?.name || "Subcategory";
    return `Cancelled reordering. Subcategory ${name} returned to original position in ${catName}.`;
  },
});

// Drag handle button used by sortable rows
const DragHandle = ({
  attributes,
  listeners,
  size = "md",
}: {
  attributes: any;
  listeners: any;
  size?: "sm" | "md";
}) => (
  <button
    type="button"
    {...attributes}
    {...listeners}
    aria-label="Reorder. Press Space or Enter to pick up, Arrow keys to move, Space or Enter to drop, Escape to cancel."
    className={`flex items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-grab active:cursor-grabbing touch-none rounded-md hover:bg-muted ${
      size === "sm" ? "h-6 w-6" : "h-8 w-8"
    }`}
  >
    <GripVertical className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
  </button>
);

const AdminCategories = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subsByCat, setSubsByCat] = useState<Record<string, Subcategory[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catDraft, setCatDraft] = useState<{ name: string; slug: string; icon: string }>({
    name: "",
    slug: "",
    icon: "",
  });
  const [newCat, setNewCat] = useState({ name: "", slug: "", icon: "" });

  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [subDraft, setSubDraft] = useState<{ name: string; slug: string }>({ name: "", slug: "" });
  const [newSubByCat, setNewSubByCat] = useState<Record<string, { name: string; slug: string }>>({});

  // Condition groups & options state
  const [groupsByCat, setGroupsByCat] = useState<Record<string, ConditionGroup[]>>({});
  const [optionsByGroup, setOptionsByGroup] = useState<Record<string, ConditionOption[]>>({});
  const [newOptionByGroup, setNewOptionByGroup] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) verifyAdminAndLoad();
  }, [user]);

  const verifyAdminAndLoad = async () => {
    try {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      if (!data) {
        toast.error("You don't have permission to access this page");
        navigate("/dashboard");
        return;
      }
      setIsAdmin(true);
      await loadAll();
    } catch {
      navigate("/dashboard");
    }
  };

  const loadAll = async () => {
    setLoading(true);
    const [catsRes, subsRes, groupsRes, optionsRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, icon, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("subcategories")
        .select("id, category_id, name, slug, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("category_condition_groups" as any)
        .select("id, category_id, name, icon, is_multi_select, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("category_condition_options" as any)
        .select("id, group_id, name, sort_order, description, examples")
        .order("sort_order", { ascending: true }),
    ]);

    if (catsRes.error) toast.error("Failed to load categories");
    if (subsRes.error) toast.error("Failed to load subcategories");

    const cats = (catsRes.data as Category[]) || [];
    const subs = (subsRes.data as Subcategory[]) || [];
    setCategories(cats);
    const grouped: Record<string, Subcategory[]> = {};
    for (const c of cats) grouped[c.id] = [];
    for (const s of subs) {
      grouped[s.category_id] = grouped[s.category_id] || [];
      grouped[s.category_id].push(s);
    }
    setSubsByCat(grouped);

    const groups = ((groupsRes.data as unknown) as ConditionGroup[]) || [];
    const options = ((optionsRes.data as unknown) as ConditionOption[]) || [];
    const groupedG: Record<string, ConditionGroup[]> = {};
    for (const c of cats) groupedG[c.id] = [];
    for (const g of groups) {
      groupedG[g.category_id] = groupedG[g.category_id] || [];
      groupedG[g.category_id].push(g);
    }
    setGroupsByCat(groupedG);

    const groupedO: Record<string, ConditionOption[]> = {};
    for (const g of groups) groupedO[g.id] = [];
    for (const o of options) {
      groupedO[o.group_id] = groupedO[o.group_id] || [];
      groupedO[o.group_id].push(o);
    }
    setOptionsByGroup(groupedO);

    setLoading(false);
  };

  // -------- Condition group operations --------
  const addConditionGroup = async (categoryId: string) => {
    const list = groupsByCat[categoryId] || [];
    const nextOrder = (list[list.length - 1]?.sort_order ?? 0) + 1;
    const { data, error } = await supabase
      .from("category_condition_groups" as any)
      .insert({
        category_id: categoryId,
        name: "New group",
        icon: null,
        is_multi_select: false,
        sort_order: nextOrder,
      })
      .select()
      .single();
    if (error) return toast.error(error.message);
    const newGroup = data as unknown as ConditionGroup;
    setGroupsByCat((p) => ({ ...p, [categoryId]: [...(p[categoryId] || []), newGroup] }));
    setOptionsByGroup((p) => ({ ...p, [newGroup.id]: [] }));
  };

  const updateConditionGroup = async (
    group: ConditionGroup,
    patch: Partial<ConditionGroup>,
  ) => {
    setGroupsByCat((p) => ({
      ...p,
      [group.category_id]: (p[group.category_id] || []).map((g) =>
        g.id === group.id ? { ...g, ...patch } : g,
      ),
    }));
    const { error } = await supabase
      .from("category_condition_groups" as any)
      .update(patch)
      .eq("id", group.id);
    if (error) toast.error(error.message);
  };

  const deleteConditionGroup = async (group: ConditionGroup) => {
    setDeletingId(group.id);
    const { error } = await supabase
      .from("category_condition_groups" as any)
      .delete()
      .eq("id", group.id);
    setDeletingId(null);
    if (error) return toast.error(error.message);
    setGroupsByCat((p) => ({
      ...p,
      [group.category_id]: (p[group.category_id] || []).filter((g) => g.id !== group.id),
    }));
    toast.success("Group deleted");
  };

  const addConditionOption = async (groupId: string) => {
    const name = (newOptionByGroup[groupId] || "").trim();
    if (!name) return;
    const list = optionsByGroup[groupId] || [];
    const nextOrder = (list[list.length - 1]?.sort_order ?? 0) + 1;
    const { data, error } = await supabase
      .from("category_condition_options" as any)
      .insert({ group_id: groupId, name, sort_order: nextOrder })
      .select()
      .single();
    if (error) return toast.error(error.message);
    setOptionsByGroup((p) => ({
      ...p,
      [groupId]: [...(p[groupId] || []), data as unknown as ConditionOption],
    }));
    setNewOptionByGroup((p) => ({ ...p, [groupId]: "" }));
  };

  const deleteConditionOption = async (option: ConditionOption) => {
    setDeletingId(option.id);
    const { error } = await supabase
      .from("category_condition_options" as any)
      .delete()
      .eq("id", option.id);
    setDeletingId(null);
    if (error) return toast.error(error.message);
    setOptionsByGroup((p) => ({
      ...p,
      [option.group_id]: (p[option.group_id] || []).filter((o) => o.id !== option.id),
    }));
  };

  const updateConditionOption = async (
    option: ConditionOption,
    patch: Partial<Pick<ConditionOption, "description" | "examples">>,
  ) => {
    setOptionsByGroup((p) => ({
      ...p,
      [option.group_id]: (p[option.group_id] || []).map((o) =>
        o.id === option.id ? { ...o, ...patch } : o,
      ),
    }));
    const { error } = await supabase
      .from("category_condition_options" as any)
      .update(patch)
      .eq("id", option.id);
    if (error) toast.error(error.message);
  };

  const persistOptionOrder = async (groupId: string, ordered: ConditionOption[]) => {
    const prev = optionsByGroup[groupId] || [];
    const updated = ordered.map((o, i) => ({ ...o, sort_order: i + 1 }));
    setOptionsByGroup((p) => ({ ...p, [groupId]: updated }));
    const { error } = await supabase
      .from("category_condition_options" as any)
      .upsert(updated);
    if (error) {
      toast.error("Failed to save option order");
      setOptionsByGroup((p) => ({ ...p, [groupId]: prev }));
    }
  };

  const onOptionDragEnd = (groupId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = optionsByGroup[groupId] || [];
    const oldIndex = list.findIndex((o) => o.id === active.id);
    const newIndex = list.findIndex((o) => o.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persistOptionOrder(groupId, arrayMove(list, oldIndex, newIndex));
  };

  // -------- Category operations --------
  const startEditCat = (c: Category) => {
    setEditingCatId(c.id);
    setCatDraft({ name: c.name, slug: c.slug, icon: c.icon || "" });
  };

  const saveCat = async (id: string) => {
    if (!catDraft.name.trim()) return toast.error("Name is required");
    setSavingId(id);
    const { error } = await supabase
      .from("categories")
      .update({
        name: catDraft.name.trim(),
        slug: (catDraft.slug || slugify(catDraft.name)).trim(),
        icon: catDraft.icon.trim() || null,
      })
      .eq("id", id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Category updated");
    setEditingCatId(null);
    loadAll();
  };

  const addCat = async () => {
    if (!newCat.name.trim()) return toast.error("Name is required");
    const nextOrder = (categories[categories.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("categories").insert({
      name: newCat.name.trim(),
      slug: (newCat.slug || slugify(newCat.name)).trim(),
      icon: newCat.icon.trim() || null,
      sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    toast.success("Category added");
    setNewCat({ name: "", slug: "", icon: "" });
    loadAll();
  };

  const deleteCat = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    setDeletingId(null);
    if (error) return toast.error(error.message);
    toast.success("Category deleted");
    loadAll();
  };

  // Persist a new ordering by writing sequential sort_order values.
  // Optimistically updates UI, rolls back on failure.
  const persistCategoryOrder = async (ordered: Category[]) => {
    const prev = categories;
    const updated = ordered.map((c, i) => ({ ...c, sort_order: i + 1 }));
    setCategories(updated);
    const { error } = await supabase.from("categories").upsert(updated);
    if (error) {
      toast.error("Failed to save order");
      setCategories(prev);
    }
  };

  const categoryAnnouncements = {
    onDragStart({ active }: { active: any }) {
      const name = active.data.current?.name || "Category";
      return `Picked up category ${name}. Press arrow keys to move, space or enter to drop, escape to cancel.`;
    },
    onDragOver({ active, over }: { active: any; over: any }) {
      const name = active.data.current?.name || "Category";
      if (over) {
        const idx = categories.findIndex((c) => c.id === over.id) + 1;
        return `Moving category ${name} to position ${idx} of ${categories.length}.`;
      }
      return `Moving category ${name}.`;
    },
    onDragEnd({ active, over }: { active: any; over: any }) {
      const name = active.data.current?.name || "Category";
      if (over) {
        const idx = categories.findIndex((c) => c.id === over.id) + 1;
        return `Dropped category ${name} at position ${idx} of ${categories.length}.`;
      }
      return `Dropped category ${name}.`;
    },
    onDragCancel({ active }: { active: any }) {
      const name = active.data.current?.name || "Category";
      return `Cancelled reordering. Category ${name} returned to original position.`;
    },
  };

  const onCategoryDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex((c) => c.id === active.id);
    const newIndex = categories.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categories, oldIndex, newIndex);
    persistCategoryOrder(reordered);
  };

  // -------- Subcategory operations --------
  const startEditSub = (s: Subcategory) => {
    setEditingSubId(s.id);
    setSubDraft({ name: s.name, slug: s.slug });
  };

  const saveSub = async (id: string) => {
    if (!subDraft.name.trim()) return toast.error("Name is required");
    setSavingId(id);
    const { error } = await supabase
      .from("subcategories")
      .update({
        name: subDraft.name.trim(),
        slug: (subDraft.slug || slugify(subDraft.name)).trim(),
      })
      .eq("id", id);
    setSavingId(null);
    if (error) return toast.error(error.message);
    toast.success("Subcategory updated");
    setEditingSubId(null);
    loadAll();
  };

  const addSub = async (categoryId: string) => {
    const draft = newSubByCat[categoryId] || { name: "", slug: "" };
    if (!draft.name.trim()) return toast.error("Name is required");
    const list = subsByCat[categoryId] || [];
    const nextOrder = (list[list.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("subcategories").insert({
      category_id: categoryId,
      name: draft.name.trim(),
      slug: (draft.slug || slugify(draft.name)).trim(),
      sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    toast.success("Subcategory added");
    setNewSubByCat((prev) => ({ ...prev, [categoryId]: { name: "", slug: "" } }));
    loadAll();
  };

  const deleteSub = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("subcategories").delete().eq("id", id);
    setDeletingId(null);
    if (error) return toast.error(error.message);
    toast.success("Subcategory deleted");
    loadAll();
  };

  const persistSubcategoryOrder = async (categoryId: string, ordered: Subcategory[]) => {
    const prev = subsByCat[categoryId] || [];
    const updated = ordered.map((s, i) => ({ ...s, sort_order: i + 1 }));
    setSubsByCat((p) => ({ ...p, [categoryId]: updated }));
    const { error } = await supabase.from("subcategories").upsert(updated);
    if (error) {
      toast.error("Failed to save order");
      setSubsByCat((p) => ({ ...p, [categoryId]: prev }));
    }
  };

  const onSubDragEnd = (categoryId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const list = subsByCat[categoryId] || [];
    const oldIndex = list.findIndex((s) => s.id === active.id);
    const newIndex = list.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    persistSubcategoryOrder(categoryId, arrayMove(list, oldIndex, newIndex));
  };

  if (authLoading || !isAdmin) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Categories"
      description="Create, edit, and remove top-level categories and their subcategories. Drag the handle on the left to reorder, or focus it with Tab and use Space then Arrow keys."
    >
      <div className="max-w-4xl">


          {/* Add new category */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Add Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Input
                  placeholder="Name (e.g. Property)"
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                />
                <Input
                  placeholder="Slug (auto)"
                  value={newCat.slug}
                  onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })}
                />
                <Input
                  placeholder="Icon (lucide name, e.g. Home)"
                  value={newCat.icon}
                  onChange={(e) => setNewCat({ ...newCat, icon: e.target.value })}
                />
                <Button onClick={addCat}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            </CardContent>
          </Card>

          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onCategoryDragEnd}
              accessibility={{ announcements: categoryAnnouncements }}
            >
              <SortableContext
                items={categories.map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {categories.map((cat) => {
                    const isOpen = !!expanded[cat.id];
                    const isEditing = editingCatId === cat.id;
                    const subs = subsByCat[cat.id] || [];
                    const subDraftNew = newSubByCat[cat.id] || { name: "", slug: "" };
                    const subAnnouncements = makeSubAnnouncements(cat.name, subs);

                    return (
                      <SortableCategoryCard key={cat.id} id={cat.id} data={{ name: cat.name }}>
                        {({ attributes, listeners }) => (
                          <Card>
                            <CardContent className="p-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                <DragHandle attributes={attributes} listeners={listeners} />

                                {/* Expand toggle */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    setExpanded((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                                  }
                                >
                                  {isOpen ? (
                                    <ChevronDown className="w-4 h-4" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4" />
                                  )}
                                </Button>

                                {isEditing ? (
                                  <div className="flex flex-1 gap-2 flex-wrap min-w-0">
                                    <Input
                                      className="flex-1 min-w-[140px]"
                                      value={catDraft.name}
                                      onChange={(e) =>
                                        setCatDraft({ ...catDraft, name: e.target.value })
                                      }
                                      placeholder="Name"
                                    />
                                    <Input
                                      className="flex-1 min-w-[120px]"
                                      value={catDraft.slug}
                                      onChange={(e) =>
                                        setCatDraft({ ...catDraft, slug: e.target.value })
                                      }
                                      placeholder="Slug"
                                    />
                                    <Input
                                      className="flex-1 min-w-[120px]"
                                      value={catDraft.icon}
                                      onChange={(e) =>
                                        setCatDraft({ ...catDraft, icon: e.target.value })
                                      }
                                      placeholder="Icon"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold truncate">{cat.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      /{cat.slug} · {cat.icon || "no icon"} · {subs.length}{" "}
                                      subcategor{subs.length === 1 ? "y" : "ies"}
                                    </div>
                                  </div>
                                )}

                                <div className="flex gap-1 ml-auto">
                                  {isEditing ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => saveCat(cat.id)}
                                        disabled={savingId === cat.id}
                                      >
                                        {savingId === cat.id ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Save className="w-4 h-4" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditingCatId(null)}
                                      >
                                        <X className="w-4 h-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => startEditCat(cat)}
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-destructive"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>
                                              Delete "{cat.name}"?
                                            </AlertDialogTitle>
                                            <AlertDialogDescription>
                                              This will also remove all of its subcategories.
                                              Listings linked to this category will lose their
                                              category assignment. This cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel disabled={deletingId === cat.id}>Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => deleteCat(cat.id)}
                                              loading={deletingId === cat.id}
                                              loadingText="Deleting..."
                                              disabled={deletingId === cat.id}
                                            >
                                              Delete
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </>
                                  )}
                                </div>
                              </div>

                              {isOpen && (
                                <div className="mt-4 pl-4 border-l-2 border-border space-y-2">
                                  {subs.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                      No subcategories yet.
                                    </p>
                                  )}

                                  <DndContext
                                    sensors={sensors}
                                    collisionDetection={closestCenter}
                                    onDragEnd={onSubDragEnd(cat.id)}
                                    accessibility={{ announcements: subAnnouncements }}
                                  >
                                    <SortableContext
                                      items={subs.map((s) => s.id)}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      {subs.map((sub) => {
                                        const isSubEditing = editingSubId === sub.id;
                                        return (
                                          <SortableSubRow key={sub.id} id={sub.id} data={{ name: sub.name }}>
                                            {({ attributes, listeners }) => (
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <DragHandle
                                                  attributes={attributes}
                                                  listeners={listeners}
                                                  size="sm"
                                                />
                                                {isSubEditing ? (
                                                  <div className="flex flex-1 gap-2 flex-wrap min-w-0">
                                                    <Input
                                                      className="flex-1 min-w-[140px] h-8"
                                                      value={subDraft.name}
                                                      onChange={(e) =>
                                                        setSubDraft({
                                                          ...subDraft,
                                                          name: e.target.value,
                                                        })
                                                      }
                                                      placeholder="Name"
                                                    />
                                                    <Input
                                                      className="flex-1 min-w-[120px] h-8"
                                                      value={subDraft.slug}
                                                      onChange={(e) =>
                                                        setSubDraft({
                                                          ...subDraft,
                                                          slug: e.target.value,
                                                        })
                                                      }
                                                      placeholder="Slug"
                                                    />
                                                  </div>
                                                ) : (
                                                  <div className="flex-1 min-w-0">
                                                    <span className="text-sm font-medium">
                                                      {sub.name}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                      /{sub.slug}
                                                    </span>
                                                  </div>
                                                )}
                                                <div className="flex gap-1 ml-auto">
                                                  {isSubEditing ? (
                                                    <>
                                                      <Button
                                                        size="sm"
                                                        onClick={() => saveSub(sub.id)}
                                                        disabled={savingId === sub.id}
                                                      >
                                                        <Save className="w-3 h-3" />
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingSubId(null)}
                                                      >
                                                        <X className="w-3 h-3" />
                                                      </Button>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => startEditSub(sub)}
                                                      >
                                                        <Pencil className="w-3 h-3" />
                                                      </Button>
                                                      <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-destructive"
                                                          >
                                                            <Trash2 className="w-3 h-3" />
                                                          </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                          <AlertDialogHeader>
                                                            <AlertDialogTitle>
                                                              Delete "{sub.name}"?
                                                            </AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                              Listings linked to this subcategory
                                                              will lose the subcategory
                                                              assignment. This cannot be undone.
                                                            </AlertDialogDescription>
                                                          </AlertDialogHeader>
                                                          <AlertDialogFooter>
                                                            <AlertDialogCancel disabled={deletingId === sub.id}>
                                                              Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                              onClick={() => deleteSub(sub.id)}
                                                              loading={deletingId === sub.id}
                                                              loadingText="Deleting..."
                                                              disabled={deletingId === sub.id}
                                                            >
                                                              Delete
                                                            </AlertDialogAction>
                                                          </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                      </AlertDialog>
                                                    </>
                                                  )}
                                                </div>
                                              </div>
                                            )}
                                          </SortableSubRow>
                                        );
                                      })}
                                    </SortableContext>
                                  </DndContext>

                                  {/* Add subcategory inline */}
                                  <div className="flex gap-2 flex-wrap pt-2">
                                    <Input
                                      className="flex-1 min-w-[140px] h-8"
                                      placeholder="New subcategory name"
                                      value={subDraftNew.name}
                                      onChange={(e) =>
                                        setNewSubByCat((prev) => ({
                                          ...prev,
                                          [cat.id]: { ...subDraftNew, name: e.target.value },
                                        }))
                                      }
                                    />
                                    <Input
                                      className="flex-1 min-w-[120px] h-8"
                                      placeholder="Slug (auto)"
                                      value={subDraftNew.slug}
                                      onChange={(e) =>
                                        setNewSubByCat((prev) => ({
                                          ...prev,
                                          [cat.id]: { ...subDraftNew, slug: e.target.value },
                                        }))
                                      }
                                    />
                                    <Button size="sm" onClick={() => addSub(cat.id)}>
                                      <Plus className="w-3 h-3 mr-1" /> Add
                                    </Button>
                                  </div>

                                  {/* Condition Groups Builder */}
                                  <div className="mt-4 pt-4 border-t border-border space-y-3 animate-in fade-in-50 duration-200">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-muted-foreground" />
                                        <h4 className="text-sm font-semibold">
                                          Condition Groups & Options
                                        </h4>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => addConditionGroup(cat.id)}
                                      >
                                        <Plus className="w-3 h-3 mr-1" /> Add Group
                                      </Button>
                                    </div>

                                    {(groupsByCat[cat.id] || []).length === 0 && (
                                      <p className="text-xs text-muted-foreground">
                                        No condition groups yet. Add one to define filterable
                                        condition pills for this category.
                                      </p>
                                    )}

                                    <div className="space-y-2">
                                      {(groupsByCat[cat.id] || []).map((group) => {
                                        const opts = optionsByGroup[group.id] || [];
                                        const draftOpt = newOptionByGroup[group.id] || "";
                                        return (
                                          <div
                                            key={group.id}
                                            className="rounded-md border border-border bg-muted/30 p-3 space-y-3"
                                          >
                                            <div className="grid gap-2 sm:grid-cols-[1fr_200px_120px_auto] items-start">
                                              <Input
                                                className="h-8"
                                                placeholder="Group name (e.g. Brand New)"
                                                value={group.name}
                                                onChange={(e) =>
                                                  setGroupsByCat((p) => ({
                                                    ...p,
                                                    [cat.id]: (p[cat.id] || []).map((g) =>
                                                      g.id === group.id
                                                        ? { ...g, name: e.target.value }
                                                        : g,
                                                    ),
                                                  }))
                                                }
                                                onBlur={(e) =>
                                                  updateConditionGroup(group, {
                                                    name: e.target.value.trim() || "Untitled",
                                                  })
                                                }
                                              />
                                              {(() => {
                                                const raw = group.icon || "";
                                                const trimmed = raw.trim();
                                                const IconCmp = resolveLucideIcon(trimmed);
                                                const isInvalid = trimmed.length > 0 && !IconCmp;
                                                return (
                                                  <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5">
                                                      <div
                                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                                                          isInvalid
                                                            ? "border-destructive/50 text-destructive"
                                                            : "border-border text-muted-foreground"
                                                        } bg-background`}
                                                        aria-label={
                                                          IconCmp
                                                            ? `Icon preview: ${trimmed}`
                                                            : "No icon preview"
                                                        }
                                                      >
                                                        {IconCmp ? (
                                                          <IconCmp className="w-4 h-4" />
                                                        ) : (
                                                          <HelpCircle className="w-4 h-4 opacity-60" />
                                                        )}
                                                      </div>
                                                      <IconPicker
                                                        value={trimmed || null}
                                                        onChange={async (name) => {
                                                          // Normalize to canonical PascalCase Lucide name
                                                          const canonical = name
                                                            ? toPascalIconName(name)
                                                            : null;
                                                          setGroupsByCat((p) => ({
                                                            ...p,
                                                            [cat.id]: (p[cat.id] || []).map((g) =>
                                                              g.id === group.id
                                                                ? { ...g, icon: canonical || "" }
                                                                : g,
                                                            ),
                                                          }));
                                                          try {
                                                            await updateConditionGroup(group, {
                                                              icon: canonical,
                                                            });
                                                            toast.success(
                                                              canonical
                                                                ? `Icon "${canonical}" saved`
                                                                : "Icon cleared",
                                                            );
                                                          } catch (err: any) {
                                                            toast.error(
                                                              err?.message || "Failed to save icon",
                                                            );
                                                          }
                                                        }}
                                                      />
                                                      <Input
                                                        className={`h-8 ${
                                                          isInvalid
                                                            ? "border-destructive focus-visible:ring-destructive"
                                                            : ""
                                                        }`}
                                                        placeholder="Icon (e.g. Sparkles)"
                                                        value={raw}
                                                        aria-invalid={isInvalid}
                                                        onChange={(e) =>
                                                          setGroupsByCat((p) => ({
                                                            ...p,
                                                            [cat.id]: (p[cat.id] || []).map((g) =>
                                                              g.id === group.id
                                                                ? { ...g, icon: e.target.value }
                                                                : g,
                                                            ),
                                                          }))
                                                        }
                                                        onBlur={(e) => {
                                                          const v = e.target.value.trim();
                                                          if (v.length > 0 && !resolveLucideIcon(v)) {
                                                            toast.error(
                                                              `"${v}" isn't a Lucide icon. Try names like Sparkles, RefreshCw, Handshake.`,
                                                            );
                                                            return;
                                                          }
                                                          updateConditionGroup(group, {
                                                            icon: v || null,
                                                          });
                                                        }}
                                                      />
                                                    </div>
                                                    {isInvalid ? (
                                                      <p className="text-[10px] leading-tight text-destructive">
                                                        Not a Lucide icon name.
                                                      </p>
                                                    ) : (
                                                      <p className="text-[10px] leading-tight text-muted-foreground">
                                                        See{" "}
                                                        <a
                                                          href="https://lucide.dev/icons"
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className="underline hover:text-foreground"
                                                        >
                                                          lucide.dev/icons
                                                        </a>
                                                      </p>
                                                    )}
                                                  </div>
                                                );
                                              })()}
                                              <Input
                                                type="number"
                                                className="h-8"
                                                placeholder="Sort"
                                                value={group.sort_order}
                                                onChange={(e) =>
                                                  setGroupsByCat((p) => ({
                                                    ...p,
                                                    [cat.id]: (p[cat.id] || []).map((g) =>
                                                      g.id === group.id
                                                        ? {
                                                            ...g,
                                                            sort_order:
                                                              Number(e.target.value) || 0,
                                                          }
                                                        : g,
                                                    ),
                                                  }))
                                                }
                                                onBlur={(e) =>
                                                  updateConditionGroup(group, {
                                                    sort_order: Number(e.target.value) || 0,
                                                  })
                                                }
                                              />
                                              <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-destructive h-8 w-8 p-0"
                                                  >
                                                    <Trash2 className="w-3 h-3" />
                                                  </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                  <AlertDialogHeader>
                                                    <AlertDialogTitle>
                                                      Delete group "{group.name}"?
                                                    </AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                      All options inside this group will also be
                                                      removed.
                                                    </AlertDialogDescription>
                                                  </AlertDialogHeader>
                                                  <AlertDialogFooter>
                                                    <AlertDialogCancel disabled={deletingId === group.id}>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                      onClick={() => deleteConditionGroup(group)}
                                                      loading={deletingId === group.id}
                                                      loadingText="Deleting..."
                                                      disabled={deletingId === group.id}
                                                    >
                                                      Delete
                                                    </AlertDialogAction>
                                                  </AlertDialogFooter>
                                                </AlertDialogContent>
                                              </AlertDialog>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              <Switch
                                                id={`multi-${group.id}`}
                                                checked={group.is_multi_select}
                                                onCheckedChange={(v) =>
                                                  updateConditionGroup(group, {
                                                    is_multi_select: v,
                                                  })
                                                }
                                              />
                                              <Label
                                                htmlFor={`multi-${group.id}`}
                                                className="text-xs"
                                              >
                                                Multi-select
                                              </Label>
                                            </div>

                                            {/* Options chips (drag to reorder) */}
                                            <DndContext
                                              sensors={sensors}
                                              collisionDetection={closestCenter}
                                              onDragEnd={onOptionDragEnd(group.id)}
                                            >
                                              <SortableContext
                                                items={opts.map((o) => o.id)}
                                                strategy={verticalListSortingStrategy}
                                              >
                                                <div className="flex flex-wrap gap-1.5 items-center">
                                                  {opts.map((o) => (
                                                    <SortableOptionChip key={o.id} id={o.id}>
                                                      {({ attributes, listeners }) => (
                                                        <Badge
                                                          variant="secondary"
                                                          className="gap-1 pl-1 pr-1"
                                                        >
                                                          <button
                                                            type="button"
                                                            {...attributes}
                                                            {...listeners}
                                                            aria-label={`Reorder ${o.name}. Press Space or Enter to pick up, Arrow keys to move.`}
                                                            className="flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none rounded-sm p-0.5"
                                                          >
                                                            <GripVertical className="w-3 h-3" />
                                                          </button>
                                                          {o.name}
                                                          <OptionHelpEditor
                                                            option={o}
                                                            onSave={(patch) => updateConditionOption(o, patch)}
                                                          />
                                                          <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                              <button
                                                                type="button"
                                                                className="rounded-full hover:bg-background/60 p-0.5"
                                                                aria-label={`Remove ${o.name}`}
                                                              >
                                                                <X className="w-3 h-3" />
                                                              </button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                              <AlertDialogHeader>
                                                                <AlertDialogTitle>
                                                                  Remove option "{o.name}"?
                                                                </AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                  This option will no longer be available
                                                                  for sellers to choose in the "{group.name}"
                                                                  group. This cannot be undone.
                                                                </AlertDialogDescription>
                                                              </AlertDialogHeader>
                                                              <AlertDialogFooter>
                                                                <AlertDialogCancel disabled={deletingId === o.id}>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                  onClick={() => deleteConditionOption(o)}
                                                                  loading={deletingId === o.id}
                                                                  loadingText="Removing..."
                                                                  disabled={deletingId === o.id}
                                                                >
                                                                  Remove
                                                                </AlertDialogAction>
                                                              </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                          </AlertDialog>
                                                        </Badge>
                                                      )}
                                                    </SortableOptionChip>
                                                  ))}
                                                  <Input
                                                    className="h-7 w-40 text-xs"
                                                    placeholder="Add option, press Enter"
                                                    value={draftOpt}
                                                    onChange={(e) =>
                                                      setNewOptionByGroup((p) => ({
                                                        ...p,
                                                        [group.id]: e.target.value,
                                                      }))
                                                    }
                                                    onKeyDown={(e) => {
                                                      if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        addConditionOption(group.id);
                                                      }
                                                    }}
                                                  />
                                                </div>
                                              </SortableContext>
                                            </DndContext>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </SortableCategoryCard>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}

          <ConditionHelpAnalytics />
      </div>

    </AdminLayout>
  );
};


// Sortable wrappers — render-prop pattern keeps drag listeners scoped to the handle.
const SortableCategoryCard = ({
  id,
  data,
  children,
}: {
  id: string;
  data?: Record<string, any>;
  children: (args: { attributes: any; listeners: any }) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
};

const SortableSubRow = ({
  id,
  data,
  children,
}: {
  id: string;
  data?: Record<string, any>;
  children: (args: { attributes: any; listeners: any }) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners })}
    </div>
  );
};

const SortableOptionChip = ({
  id,
  children,
}: {
  id: string;
  children: (args: { attributes: any; listeners: any }) => React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : "auto",
  };
  return (
    <div ref={setNodeRef} style={style} className="inline-flex">
      {children({ attributes, listeners })}
    </div>
  );
};

const OptionHelpEditor = ({
  option,
  onSave,
}: {
  option: ConditionOption;
  onSave: (patch: { description: string | null; examples: string | null }) => Promise<void> | void;
}) => {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(option.description ?? "");
  const [examples, setExamples] = useState(option.examples ?? "");
  const [saving, setSaving] = useState(false);
  const hasHelp = !!((option.description ?? "").trim() || (option.examples ?? "").trim());

  useEffect(() => {
    if (open) {
      setDescription(option.description ?? "");
      setExamples(option.examples ?? "");
    }
  }, [open, option.description, option.examples]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      description: description.trim() ? description.trim() : null,
      examples: examples.trim() ? examples.trim() : null,
    });
    setSaving(false);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`rounded-full hover:bg-background/60 p-0.5 ${hasHelp ? "text-primary" : "text-muted-foreground"}`}
          aria-label={`Edit help text for ${option.name}`}
          title={hasHelp ? "Edit help text" : "Add help text"}
        >
          <HelpCircle className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 space-y-3">
        <div>
          <div className="text-sm font-semibold">Help text for "{option.name}"</div>
          <p className="text-xs text-muted-foreground">
            Shown to buyers and sellers as a tooltip beside this option.
          </p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`desc-${option.id}`} className="text-xs">
            Description
          </Label>
          <Textarea
            id={`desc-${option.id}`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short explanation of what this option means."
            rows={3}
            maxLength={300}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`ex-${option.id}`} className="text-xs">
            Examples
          </Label>
          <Textarea
            id={`ex-${option.id}`}
            value={examples}
            onChange={(e) => setExamples(e.target.value)}
            placeholder="e.g. iPhone 14 with box and charger, no scratches"
            rows={2}
            maxLength={300}
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleSave} loading={saving} loadingText="Saving...">
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default AdminCategories;
