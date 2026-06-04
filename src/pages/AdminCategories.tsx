import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/Header";
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
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

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

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const AdminCategories = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subsByCat, setSubsByCat] = useState<Record<string, Subcategory[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Edit-state buffers
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
    const [catsRes, subsRes] = await Promise.all([
      supabase
        .from("categories")
        .select("id, name, slug, icon, sort_order")
        .order("sort_order", { ascending: true }),
      supabase
        .from("subcategories")
        .select("id, category_id, name, slug, sort_order")
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

  const moveCat = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;
    const a = categories[index];
    const b = categories[target];
    // Swap sort_order values
    const { error } = await supabase.from("categories").upsert([
      { ...a, sort_order: b.sort_order },
      { ...b, sort_order: a.sort_order },
    ]);
    if (error) return toast.error(error.message);
    loadAll();
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

  const moveSub = async (categoryId: string, index: number, direction: -1 | 1) => {
    const list = subsByCat[categoryId] || [];
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const a = list[index];
    const b = list[target];
    const { error } = await supabase.from("subcategories").upsert([
      { ...a, sort_order: b.sort_order },
      { ...b, sort_order: a.sort_order },
    ]);
    if (error) return toast.error(error.message);
    loadAll();
  };

  if (authLoading || !isAdmin) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-background pt-24 pb-12">
          <div className="container px-4 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-24 pb-12">
        <div className="container px-4 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Categories</h1>
            <p className="text-muted-foreground">
              Create, edit, reorder, and remove top-level categories and their subcategories.
            </p>
          </div>

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
            <div className="space-y-3">
              {categories.map((cat, index) => {
                const isOpen = !!expanded[cat.id];
                const isEditing = editingCatId === cat.id;
                const subs = subsByCat[cat.id] || [];
                const subDraftNew = newSubByCat[cat.id] || { name: "", slug: "" };

                return (
                  <Card key={cat.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Reorder */}
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveCat(index, -1)}
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => moveCat(index, 1)}
                            disabled={index === categories.length - 1}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>

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

                        {/* Name / edit fields */}
                        {isEditing ? (
                          <div className="flex flex-1 gap-2 flex-wrap min-w-0">
                            <Input
                              className="flex-1 min-w-[140px]"
                              value={catDraft.name}
                              onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })}
                              placeholder="Name"
                            />
                            <Input
                              className="flex-1 min-w-[120px]"
                              value={catDraft.slug}
                              onChange={(e) => setCatDraft({ ...catDraft, slug: e.target.value })}
                              placeholder="Slug"
                            />
                            <Input
                              className="flex-1 min-w-[120px]"
                              value={catDraft.icon}
                              onChange={(e) => setCatDraft({ ...catDraft, icon: e.target.value })}
                              placeholder="Icon"
                            />
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{cat.name}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              /{cat.slug} · {cat.icon || "no icon"} · {subs.length} subcategor
                              {subs.length === 1 ? "y" : "ies"}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
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
                              <Button size="sm" variant="ghost" onClick={() => setEditingCatId(null)}>
                                <X className="w-4 h-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => startEditCat(cat)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete "{cat.name}"?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will also remove all of its subcategories. Listings linked
                                      to this category will lose their category assignment. This
                                      cannot be undone.
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

                      {/* Subcategories */}
                      {isOpen && (
                        <div className="mt-4 pl-4 border-l-2 border-border space-y-2">
                          {subs.length === 0 && (
                            <p className="text-sm text-muted-foreground">No subcategories yet.</p>
                          )}
                          {subs.map((sub, sIdx) => {
                            const isSubEditing = editingSubId === sub.id;
                            return (
                              <div key={sub.id} className="flex items-center gap-2 flex-wrap">
                                <div className="flex flex-col">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveSub(cat.id, sIdx, -1)}
                                    disabled={sIdx === 0}
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5"
                                    onClick={() => moveSub(cat.id, sIdx, 1)}
                                    disabled={sIdx === subs.length - 1}
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </Button>
                                </div>
                                {isSubEditing ? (
                                  <div className="flex flex-1 gap-2 flex-wrap min-w-0">
                                    <Input
                                      className="flex-1 min-w-[140px] h-8"
                                      value={subDraft.name}
                                      onChange={(e) =>
                                        setSubDraft({ ...subDraft, name: e.target.value })
                                      }
                                      placeholder="Name"
                                    />
                                    <Input
                                      className="flex-1 min-w-[120px] h-8"
                                      value={subDraft.slug}
                                      onChange={(e) =>
                                        setSubDraft({ ...subDraft, slug: e.target.value })
                                      }
                                      placeholder="Slug"
                                    />
                                  </div>
                                ) : (
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium">{sub.name}</span>
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
                                            <AlertDialogTitle>Delete "{sub.name}"?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Listings linked to this subcategory will lose the
                                              subcategory assignment. This cannot be undone.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
                            );
                          })}

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
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
};

export default AdminCategories;
