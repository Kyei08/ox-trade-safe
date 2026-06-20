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
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold border transition-colors ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
};

export default SortTabs;
