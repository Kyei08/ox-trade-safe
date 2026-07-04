import { useRef, useEffect } from "react";
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
  /**
   * Called when the user clicks "Back to edit" while submission is blocked.
   * The dialog will close and the parent should focus the relevant form field.
   */
  onFocusField?: (field: "condition" | "category") => void;
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
  onFocusField,
}: Props) {
  const confirmLabel = mode === "create" ? "Publish listing" : "Save changes";
  const alertRef = useRef<HTMLDivElement>(null);

  // Auto-focus the error alert when submission is blocked so screen-reader
  // users are immediately notified.
  useEffect(() => {
    if (conditionMatch.blocksSubmit && alertRef.current) {
      alertRef.current.focus();
    }
  }, [conditionMatch.blocksSubmit]);

  // Determine which parent field is most relevant to focus when going back.
  const focusField: "condition" | "category" =
    conditionMatch.isMissingRequired && !values.categoryName
      ? "category"
      : "condition";

  return (
    <Dialog open={open} onOpenChange={(v) => (submitting ? null : onOpenChange(v))}>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review your listing</DialogTitle>
          <DialogDescription>
            Double-check the details below before {mode === "create" ? "publishing" : "saving"}.
          </DialogDescription>
        </DialogHeader>

        {/* Mismatch guard — specific, actionable copy using the actual names */}
        {conditionMatch.isMismatch && (
          <div
            ref={alertRef}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 outline-none"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  {values.conditionName && values.categoryName
                    ? `"${values.conditionName}" doesn't match ${values.categoryName}`
                    : values.conditionName
                      ? `"${values.conditionName}" doesn't match this category`
                      : "Condition doesn't match category"}
                </p>
                <p className="text-sm text-destructive/90 mt-1">
                  {values.categoryName
                    ? `Go back and select a valid condition for ${values.categoryName}.`
                       : "Go back and select a valid condition."}
                </p>
              </div>
            </div>
          </div>
        )}
        {conditionMatch.isMissingRequired && !conditionMatch.isMismatch && (
          <div
            ref={!conditionMatch.isMismatch ? alertRef : undefined}
            tabIndex={-1}
            role="alert"
            aria-live="assertive"
            className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 outline-none"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-destructive">
                  Condition required
                </p>
                <p className="text-sm text-destructive/90 mt-1">
                  {values.categoryName
                    ? `"${values.categoryName}" requires a condition. Go back and select one before ${mode === "create" ? "publishing" : "saving"}.`
                    : `Select a condition before ${mode === "create" ? "publishing" : "saving"}.`}
                </p>
              </div>
            </div>
          </div>
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
