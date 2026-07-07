import {
  Package,
  FileText,
  ShoppingBag,
  Sofa,
  Refrigerator,
  Cpu,
  Hammer,
  Wrench,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type ItemCategory =
  | "Parcel"
  | "Documents"
  | "Food"
  | "Furniture"
  | "Appliances"
  | "Electronics"
  | "Building Materials"
  | "Vehicle Parts"
  | "Bulk Goods";

const CATEGORIES: { key: ItemCategory; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "Parcel", icon: Package },
  { key: "Documents", icon: FileText },
  { key: "Food", icon: ShoppingBag },
  { key: "Furniture", icon: Sofa },
  { key: "Appliances", icon: Refrigerator },
  { key: "Electronics", icon: Cpu },
  { key: "Building Materials", icon: Hammer },
  { key: "Vehicle Parts", icon: Wrench },
  { key: "Bulk Goods", icon: Boxes },
];

interface Props {
  value: ItemCategory | null;
  onChange: (c: ItemCategory) => void;
}

const ItemCategoryGrid = ({ value, onChange }: Props) => {
  return (
    <div>
      <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-3">
        Item Category
      </div>
      <div className="grid grid-cols-3 gap-3">
        {CATEGORIES.map(({ key, icon: Icon }) => {
          const active = value === key;
          return (
            <Button
              key={key}
              type="button"
              variant="secondary"
              data-state={active ? "active" : undefined}
              onClick={() => onChange(key)}
              className="h-auto flex-col gap-2 rounded-xl p-4 text-center"
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs sm:text-sm font-semibold leading-tight whitespace-normal">
                {key}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default ItemCategoryGrid;
