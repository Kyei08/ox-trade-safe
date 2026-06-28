import { CATEGORY_MISMATCH_ERROR } from "@/lib/listingValidation";

interface CategoryMismatchErrorProps {
  visible: boolean;
}

export default function CategoryMismatchError({ visible }: CategoryMismatchErrorProps) {
  if (!visible) return null;
  return (
    <p className="text-sm font-medium text-destructive mt-2">
      {CATEGORY_MISMATCH_ERROR}
    </p>
  );
}
