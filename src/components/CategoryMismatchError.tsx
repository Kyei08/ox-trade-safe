import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CATEGORY_MISMATCH_ERROR } from "@/lib/listingValidation";

interface CategoryMismatchErrorProps {
  visible: boolean;
  className?: string;
}

/**
 * Shared condition-mismatch alert used by CreateListing, EditListing,
 * and any future form or modal that needs the canonical
 * CATEGORY_MISMATCH_ERROR presentation.
 */
export default function CategoryMismatchError({ visible, className }: CategoryMismatchErrorProps) {
  if (!visible) return null;
  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Condition doesn&apos;t match category</AlertTitle>
      <AlertDescription>{CATEGORY_MISMATCH_ERROR}</AlertDescription>
    </Alert>
  );
}
