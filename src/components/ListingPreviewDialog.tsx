import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CategoryMismatchError from "@/components/CategoryMismatchError";
import type { UseConditionCategoryMatchResult } from "@/hooks/useConditionCategoryMatch";

export interface ListingPreviewValues {
  title: string;
  description: string;
  categoryName?: string;
  subcategoryName?: string;
  conditionName?: string;
  listingType: "fixed_price" | "auction" | string;
  priceDisplay?: string;
  location?: string;
  deliveryOptions?: string[];
  images?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: ListingPreviewValues;
  conditionMatch: Pick<
    UseConditionCategoryMatchResult,
    "isMismatch" | "isMissingRequired" | "blocksSubmit" | "mismatchMessage"
  >;
  submitting: boolean;
  onConfirm: () => void;
  mode: "create" | "edit";
}

/**
 * Shared preview/confirm dialog for listing create + edit flows.
 *
 * Mirrors the same category/condition mismatch guard as the inline form:
 * the confirm button is disabled and CategoryMismatchError is rendered
 * whenever `conditionMatch.blocksSubmit` is true.
 */
export default function ListingPreviewDialog({
  open,
  onOpenChange,
  values,
  conditionMatch,
  submitting,
  onConfirm,
  mode,
}: Props) {
  const confirmLabel = mode === "create" ? "Publish listing" : "Save changes";

  return (
    <Dialog open={open} onOpenChange={(v) => (submitting ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review your listing</DialogTitle>
          <DialogDescription>
            Double-check the details below before {mode === "create" ? "publishing" : "saving"}.
          </DialogDescription>
        </DialogHeader>

        {/* Mismatch guard — identical presentation to the inline form */}
        <CategoryMismatchError visible={conditionMatch.isMismatch} />
        {conditionMatch.isMissingRequired && !conditionMatch.isMismatch && (
          <p className="text-sm text-destructive">
            Select a condition that matches the chosen category before continuing.
          </p>
        )}

        {values.images && values.images.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {values.images.slice(0, 8).map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt={`Listing image ${i + 1}`}
                className="aspect-square w-full rounded-md object-cover border border-border"
                loading="lazy"
              />
            ))}
          </div>
        )}

        <div className="space-y-3 text-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Title
            </div>
            <div className="font-medium break-words">{values.title || "—"}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Description
            </div>
            <div className="whitespace-pre-wrap break-words text-foreground/90">
              {values.description || "—"}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <PreviewField label="Category" value={values.categoryName} />
            <PreviewField label="Subcategory" value={values.subcategoryName} />
            <PreviewField label="Condition" value={values.conditionName} />
            <PreviewField
              label="Type"
              value={values.listingType === "auction" ? "Auction" : "Fixed price"}
            />
            <PreviewField label="Price" value={values.priceDisplay} />
            <PreviewField label="Location" value={values.location} />
          </div>

          {values.deliveryOptions && values.deliveryOptions.length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Delivery
              </div>
              <div className="flex flex-wrap gap-1.5">
                {values.deliveryOptions.map((d) => (
                  <Badge key={d} variant="secondary" className="capitalize">
                    {d.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Back to edit
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={submitting || conditionMatch.blocksSubmit}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PreviewField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-foreground/90 break-words">{value || "—"}</div>
    </div>
  );
}
