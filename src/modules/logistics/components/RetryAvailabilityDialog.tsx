import { useEffect, useState } from "react";
import { Clock, RefreshCw, Star, Zap, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import VehicleIcon from "./VehicleIcon";
import type { Provider } from "../data/mockProviders";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blockedProvider: Provider;
  alternatives: Provider[];
  onReselect: (providerId: string) => void;
  onRecheck?: (providerId: string) => void;
}

const formatCountdown = (iso?: string) => {
  if (!iso) return null;
  const diffMs = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(diffMs)) return null;
  if (diffMs <= 0) return "any moment now";
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `in ~${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ~${hours} hr${hours === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return `in ~${days} day${days === 1 ? "" : "s"}`;
};

const RetryAvailabilityDialog = ({
  open,
  onOpenChange,
  blockedProvider,
  alternatives,
  onReselect,
  onRecheck,
}: Props) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [open]);

  const countdown = formatCountdown(blockedProvider.availableAgainAt);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{blockedProvider.name} isn't available right now</DialogTitle>
          <DialogDescription>
            {blockedProvider.availability === "Busy"
              ? "This courier is currently on another job."
              : "This courier hasn't come online yet."}{" "}
            {countdown ? (
              <>
                Expected back online{" "}
                <span className="font-semibold text-foreground">{countdown}</span>.
              </>
            ) : (
              "No estimate available yet."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {blockedProvider.availableAgainAt && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-xs">
              <Clock className="w-4 h-4 mt-0.5 text-muted-foreground" />
              <div>
                <div className="font-semibold text-foreground">
                  Available again {countdown}
                </div>
                <div className="text-muted-foreground">
                  {new Date(blockedProvider.availableAgainAt).toLocaleString([], {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              {onRecheck && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-7 gap-1 text-xs"
                  onClick={() => onRecheck(blockedProvider.id)}
                >
                  <RefreshCw className="w-3 h-3" />
                  Re-check
                </Button>
              )}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-2">
              Available now ({alternatives.length})
            </div>
            {alternatives.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No couriers are currently online. Try again in a few minutes.
              </p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {alternatives.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onReselect(p.id);
                        onOpenChange(false);
                      }}
                      className="w-full flex items-center gap-3 rounded-lg border border-border bg-card hover:border-accent hover:bg-accent/5 px-3 py-2.5 text-left transition-colors"
                    >
                      <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <VehicleIcon vehicle={p.vehicle} className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm truncate">{p.name}</span>
                          {p.servesYourArea && (
                            <Zap className="w-3 h-3 text-accent shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-accent text-accent" />
                            {p.rating.toFixed(1)}
                          </span>
                          <span>·</span>
                          <span>ETA {p.etaLabel}</span>
                          {p.priceFrom && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-foreground">
                                R{p.priceFrom.toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-success/15 text-success hover:bg-success/15 border-0 gap-1 text-[10px] shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Now
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Keep waiting
          </Button>
          {onRecheck && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => onRecheck(blockedProvider.id)}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Re-check {blockedProvider.name.split(" ")[0]}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RetryAvailabilityDialog;
