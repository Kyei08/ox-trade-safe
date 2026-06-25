import { useMemo, useState, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import LogisticsHeader from "../components/LogisticsHeader";
import LogisticsBottomNav from "../components/LogisticsBottomNav";
import ProviderCard from "../components/ProviderCard";
import SortTabs, { type SortKey } from "../components/SortTabs";
import { mockProviders } from "../data/mockProviders";

const LogisticsProviders = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const pickup = params.get("pickup") || "Sandton";
  const town = pickup.split(",")[0].trim();
  const [sort, setSort] = useState<SortKey>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [availableNowOnly, setAvailableNowOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const availableNow = useMemo(
    () => mockProviders.filter((p) => p.availability === "Available Today"),
    []
  );

  const handleReselect = useCallback(
    (providerId: string) => {
      setSelectedId(providerId);
      const node = listRef.current?.querySelector<HTMLElement>(
        `[data-provider-id="${providerId}"]`
      );
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      const p = mockProviders.find((x) => x.id === providerId);
      if (p) {
        toast.success(`Switched to ${p.name}`, {
          description: "Available now — you can book without reloading the form.",
        });
      }
    },
    []
  );

  const handleRecheck = useCallback((providerId: string) => {
    const p = mockProviders.find((x) => x.id === providerId);
    if (!p) return;
    if (p.availability === "Available Today") {
      toast.success(`${p.name} is online`, { description: "You can book now." });
    } else {
      toast(`${p.name} is still ${p.availability.toLowerCase()}`, {
        description: "We'll keep checking. Try another courier or wait a moment.",
      });
    }
  }, []);

  const sorted = useMemo(() => {
    let list = [...mockProviders];
    if (availableNowOnly) {
      list = list.filter((p) => p.availability === "Available Today");
    }
    switch (sort) {
      case "price":
        return list.sort((a, b) => (a.priceFrom ?? Infinity) - (b.priceFrom ?? Infinity));
      case "rating":
        return list.sort((a, b) => b.rating - a.rating);
      case "eta":
        return list.sort((a, b) => (a.etaLabel || "").localeCompare(b.etaLabel || ""));
      default:
        return list.sort((a, b) => Number(b.servesYourArea) - Number(a.servesYourArea));
    }
  }, [sort, availableNowOnly]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <LogisticsHeader location={town} />
      <main className="container max-w-2xl px-3 sm:px-4 py-5 sm:py-6 space-y-5">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Edit request
        </button>

        <section>
          <h1 className="text-2xl sm:text-3xl font-bold">Available in {town}</h1>
          <div className="flex items-center justify-between gap-3 mt-3">
            <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 gap-1.5 font-semibold">
              <Zap className="w-3 h-3" />
              IN YOUR AREA
            </Badge>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 font-semibold">
                  <SlidersHorizontal className="w-4 h-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[88vw] max-w-[380px]">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-5 text-sm text-muted-foreground space-y-4">
                  <p>Price, rating, availability, coverage, vehicle, and capability filters will go here.</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex items-center justify-between gap-3 mt-3 rounded-xl border bg-card px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
              <Label htmlFor="available-now" className="text-sm font-semibold cursor-pointer">
                Available now only
              </Label>
            </div>
            <Switch
              id="available-now"
              checked={availableNowOnly}
              onCheckedChange={setAvailableNowOnly}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {sorted.length} {sorted.length === 1 ? "provider" : "providers"}
            {availableNowOnly ? (
              <> · <span className="text-success font-medium">available right now</span></>
            ) : (
              <> · <span className="text-accent font-medium">prioritised for your area</span></>
            )}
          </p>
        </section>

        <SortTabs value={sort} onChange={setSort} />

        <div ref={listRef} className="space-y-4">
          {sorted.map((p, i) => (
            <ProviderCard
              key={p.id}
              provider={p}
              highlight={i === 0 && p.servesYourArea}
              selected={selectedId === p.id}
              alternatives={availableNow}
              onReselect={handleReselect}
              onRecheck={handleRecheck}
            />
          ))}
        </div>
      </main>
      <LogisticsBottomNav />
    </div>
  );
};

export default LogisticsProviders;
