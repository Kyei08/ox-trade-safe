import { Star, MapPin, Clock, Zap, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import VehicleIcon from "./VehicleIcon";
import type { Provider } from "../data/mockProviders";

const availabilityColor = (a: Provider["availability"]) => {
  switch (a) {
    case "Available Today":
      return "text-success";
    case "Available Tomorrow":
      return "text-muted-foreground";
    case "Busy":
      return "text-destructive";
  }
};

const PriceBlock = ({ provider }: { provider: Provider }) => {
  if (provider.priceMode === "quote") {
    return (
      <div className="text-right">
        <div className="font-bold text-foreground">Quote</div>
        <div className="text-[10px] tracking-wider uppercase text-muted-foreground">Custom</div>
      </div>
    );
  }
  return (
    <div className="text-right">
      <div className="text-xl font-bold text-accent">R{provider.priceFrom?.toLocaleString()}</div>
      <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
        {provider.priceMode === "fixed" ? "Fixed" : "From"}
      </div>
    </div>
  );
};

interface Props {
  provider: Provider;
  highlight?: boolean;
}

const formatLastSeen = (iso?: string) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
};

const ProviderCard = ({ provider, highlight }: Props) => {
  const isAvailableNow = provider.availability === "Available Today";
  const isInstant = provider.priceMode !== "quote";
  const canBook = isInstant && isAvailableNow;
  const lastSeen = formatLastSeen(provider.lastAvailableAt);

  const handleBlockedBook = () => {
    const lastSeenText = lastSeen ? ` Last available ${lastSeen}.` : "";
    toast.error(`${provider.name} isn't available right now`, {
      description:
        (provider.availability === "Busy"
          ? `This courier is currently busy.`
          : `This courier is only available tomorrow.`) +
        `${lastSeenText} Pickups require a courier with "Available now" status.`,
    });
  };

  return (
    <article
      className={`rounded-2xl border bg-card p-4 sm:p-5 shadow-card ${
        highlight ? "border-accent ring-1 ring-accent/40" : "border-border"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <VehicleIcon vehicle={provider.vehicle} className="w-6 h-6 text-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-base leading-tight truncate">{provider.name}</h3>
          <div className="text-[11px] tracking-wider uppercase text-muted-foreground mt-0.5">
            {provider.type}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Star className="w-4 h-4 fill-accent text-accent" />
            <span className="text-sm font-semibold">{provider.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">
              ({provider.reviews.toLocaleString()} reviews)
            </span>
          </div>
        </div>
        <PriceBlock provider={provider} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-4 border-t text-sm">
        <div className={`flex items-center gap-2 font-semibold ${availabilityColor(provider.availability)}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          {provider.availability}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="w-4 h-4" />
          <span className="text-xs tracking-wider uppercase font-semibold text-foreground">
            {provider.coverage}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>ETA: {provider.etaLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <VehicleIcon vehicle={provider.vehicle} className="w-4 h-4" />
          <span>{provider.vehicle}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-4">
        {isAvailableNow && (
          <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 gap-1 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
            Available now
          </Badge>
        )}
        {provider.servesYourArea && (
          <Badge className="bg-accent/15 text-accent hover:bg-accent/15 border-0 gap-1">
            <Zap className="w-3 h-3" />
            Serves your area
          </Badge>
        )}
        {provider.capabilities.slice(0, 3).map((c) => (
          <Badge key={c} variant="secondary" className="font-medium">
            {c}
          </Badge>
        ))}
      </div>

      {provider.description && (
        <p className="text-sm text-muted-foreground mt-3">{provider.description}</p>
      )}

      {!isAvailableNow && (
        <div
          role="alert"
          aria-live="polite"
          className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive"
        >
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <div>
              <strong>{provider.name} isn't available now.</strong> Pickups require a courier with{" "}
              <strong>Available now</strong> status.
            </div>
            {lastSeen && (
              <div className="text-destructive/80">Last available {lastSeen}.</div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button variant="outline" className="font-semibold">
          Request Quote
        </Button>
        {canBook ? (
          <Button className="font-semibold bg-primary hover:bg-primary/90">
            Instant Book
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleBlockedBook}
            aria-disabled
            className="font-semibold bg-muted text-muted-foreground hover:bg-muted"
          >
            <Lock className="w-3.5 h-3.5 mr-1.5" />
            {isInstant ? "Unavailable" : "Quote only"}
          </Button>
        )}
      </div>
    </article>
  );
};

export default ProviderCard;
