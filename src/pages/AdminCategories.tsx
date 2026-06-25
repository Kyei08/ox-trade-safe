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
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

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
        .select("id, group_id, name, sort_order")
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
    setLoading(false);
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
    const { error } = await supabase.from("categories").delete().eq("id", id);
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
    const { error } = await supabase.from("subcategories").delete().eq("id", id);
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
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteCat(cat.id)}>
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
                                                            <AlertDialogCancel>
                                                              Cancel
                                                            </AlertDialogCancel>
                                                            <AlertDialogAction
                                                              onClick={() => deleteSub(sub.id)}
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

export default AdminCategories;
