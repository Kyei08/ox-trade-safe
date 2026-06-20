import { useState } from "react";
import { ChevronDown, Camera } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

const NotesPhotosDimensions = () => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-xs font-bold tracking-wider uppercase">
          Notes, Photos & Dimensions
        </span>
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t pt-4">
          <Textarea placeholder="Add notes for the courier (fragile, leave at door, etc.)" rows={3} />
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="L (cm)" />
            <Input placeholder="W (cm)" />
            <Input placeholder="H (cm)" />
          </div>
          <Input placeholder="Estimated weight (kg)" />
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <Camera className="w-4 h-4" />
            Add photos
          </button>
        </div>
      )}
    </div>
  );
};

export default NotesPhotosDimensions;
