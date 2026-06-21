import { Star, MapPin, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const ProviderCard = ({ provider, highlight }: Props) => {
  const isInstant = provider.priceMode !== "quote";

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
        {provider.availability === "Available Today" && (
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

      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button variant="outline" className="font-semibold">
          Request Quote
        </Button>
        <Button
          disabled={!isInstant}
          className="font-semibold bg-primary hover:bg-primary/90"
        >
          Instant Book
        </Button>
      </div>
    </article>
  );
};

export default ProviderCard;
