import { MapPin } from "lucide-react";

interface Props {
  pickup: string;
  dropoff: string;
  onPickupChange: (v: string) => void;
  onDropoffChange: (v: string) => void;
}

const PickupDropoffCard = ({ pickup, dropoff, onPickupChange, onDropoffChange }: Props) => {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-accent/10 p-4 sm:p-5">
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, hsl(var(--accent)/0.15), transparent 40%), radial-gradient(circle at 80% 70%, hsl(var(--primary)/0.1), transparent 40%)",
        }}
        aria-hidden
      />
      <div className="relative bg-card rounded-xl shadow-card divide-y">
        <div className="flex items-start gap-3 p-4">
          <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Pickup
            </div>
            <input
              value={pickup}
              onChange={(e) => onPickupChange(e.target.value)}
              placeholder="Enter pickup location"
              className="w-full bg-transparent outline-none font-semibold text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
        <div className="flex items-start gap-3 p-4">
          <MapPin className="mt-0.5 w-4 h-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Drop-off
            </div>
            <input
              value={dropoff}
              onChange={(e) => onDropoffChange(e.target.value)}
              placeholder="Enter drop-off location"
              className="w-full bg-transparent outline-none font-semibold text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PickupDropoffCard;
