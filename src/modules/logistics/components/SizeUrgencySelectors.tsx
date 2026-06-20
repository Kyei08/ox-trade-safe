import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ItemSize = "Small" | "Medium" | "Large" | "Extra Large";
export type Urgency = "ASAP" | "Same Day" | "Scheduled";

interface Props {
  size: ItemSize;
  urgency: Urgency;
  onSizeChange: (s: ItemSize) => void;
  onUrgencyChange: (u: Urgency) => void;
}

const SizeUrgencySelectors = ({ size, urgency, onSizeChange, onUrgencyChange }: Props) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
          Size
        </div>
        <Select value={size} onValueChange={(v) => onSizeChange(v as ItemSize)}>
          <SelectTrigger className="border-0 px-0 h-auto font-semibold text-base focus:ring-0 shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Small">Small</SelectItem>
            <SelectItem value="Medium">Medium</SelectItem>
            <SelectItem value="Large">Large</SelectItem>
            <SelectItem value="Extra Large">Extra Large</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl border bg-card p-3">
        <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase mb-1">
          Urgency
        </div>
        <Select value={urgency} onValueChange={(v) => onUrgencyChange(v as Urgency)}>
          <SelectTrigger className="border-0 px-0 h-auto font-semibold text-base text-accent focus:ring-0 shadow-none">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ASAP">ASAP</SelectItem>
            <SelectItem value="Same Day">Same Day</SelectItem>
            <SelectItem value="Scheduled">Scheduled</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default SizeUrgencySelectors;
