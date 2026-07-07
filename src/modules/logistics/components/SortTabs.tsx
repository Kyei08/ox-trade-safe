import { Button } from "@/components/ui/button";

export type SortKey = "recommended" | "price" | "rating" | "eta";

const OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "price", label: "Lowest price" },
  { key: "rating", label: "Top rated" },
  { key: "eta", label: "Fastest ETA" },
];

interface Props {
  value: SortKey;
  onChange: (k: SortKey) => void;
}

const SortTabs = ({ value, onChange }: Props) => {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
      {OPTIONS.map((o) => {
        const active = value === o.key;
        return (
          <Button
            key={o.key}
            type="button"
            size="sm"
            variant="secondary"
            data-state={active ? "active" : undefined}
            onClick={() => onChange(o.key)}
            className="shrink-0 rounded-full font-semibold"
          >
            {o.label}
          </Button>
        );
      })}
    </div>
  );
};

export default SortTabs;
