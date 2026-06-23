import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, X, Truck, Store } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type EcosystemApp = {
  id: string;
  label: string;
  icon: ReactNode;
  color: string;
  action: () => void;
};

interface OxEcosystemFABProps {
  logisticsEnabled?: boolean;
  servicesUrl?: string;
}

const OxEcosystemFAB = ({
  logisticsEnabled = true,
  servicesUrl = "https://blue-sky-dreams.lovable.app",
}: OxEcosystemFABProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const apps: EcosystemApp[] = [
    {
      id: "logistics",
      label: "OX Logistics",
      icon: <Truck className="h-5 w-5" />,
      color: "#FF7A00",
      action: () => {
        if (logisticsEnabled) {
          navigate("/logistics");
        } else {
          toast.info("OX Logistics coming soon.");
        }
        setOpen(false);
      },
    },
    {
      id: "marketplace",
      label: "OX Marketplace",
      icon: <Store className="h-5 w-5" />,
      color: "#2563EB",
      action: () => {
        navigate("/");
        setOpen(false);
      },
    },
  ];

  return (
    <div
      ref={containerRef}
      className="fixed right-4 sm:right-6 bottom-[calc(env(safe-area-inset-bottom)+5rem)] sm:bottom-6 z-[60] flex flex-col items-end gap-3"
    >
      {open && (
        <div className="flex flex-col items-end gap-3 mb-1">
          {apps.map((app, i) => (
            <button
              key={app.id}
              onClick={app.action}
              style={{
                backgroundColor: app.color,
                animationDelay: `${i * 60}ms`,
              }}
              className="group flex items-center gap-2 rounded-full pl-4 pr-5 py-3 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-transform animate-fade-in"
            >
              {app.icon}
              <span className="text-sm font-medium whitespace-nowrap">{app.label}</span>
            </button>
          ))}
        </div>
      )}

      <button
        aria-label={open ? "Close ecosystem menu" : "Open OX ecosystem menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-14 w-14 rounded-full bg-black text-white shadow-xl flex items-center justify-center",
          "hover:scale-110 active:scale-95 transition-transform duration-200",
          "ring-1 ring-white/10"
        )}
      >
        <span className="relative inline-flex items-center justify-center">
          {open ? (
            <X className="h-6 w-6 animate-scale-in" />
          ) : (
            <Shield className="h-6 w-6 animate-scale-in" />
          )}
        </span>
      </button>
    </div>
  );
};

export default OxEcosystemFAB;
