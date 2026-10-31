import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { X, Truck, Store, Wrench } from "lucide-react";
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

const MOBILE_QUERY = "(max-width: 767px)";
// Baseline keeps the FAB clear of the iOS/Android home-indicator area.
const BASE_BOTTOM = "calc(env(safe-area-inset-bottom, 0px) + 5rem)";
// Breathing room kept between the menu and anything anchored to the bottom.
const BAR_GAP_PX = 16;

/**
 * Distance (px from the viewport bottom) the menu must sit at to clear every
 * fixed/sticky control docked at the bottom of the screen — bottom navs, sticky
 * checkout bars, conversation inputs. Returns 0 when nothing is docked there.
 */
function measureBottomDockedTop(container: HTMLElement | null): number {
  const vh = window.innerHeight;
  let dockedTop = vh;

  for (const el of document.querySelectorAll<HTMLElement>("body *")) {
    if (container?.contains(el) || el.closest("[data-sonner-toaster]")) continue;

    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) continue;

    const rect = el.getBoundingClientRect();
    if (rect.height === 0 || rect.width === 0) continue;
    // Only bars anchored near the bottom edge of the viewport (not overlays/dialogs).
    if (rect.bottom < vh - 12 || rect.top < vh * 0.5) continue;

    if (rect.top < dockedTop) dockedTop = rect.top;
  }

  return dockedTop >= vh ? 0 : Math.max(0, Math.ceil(vh - dockedTop + BAR_GAP_PX));
}

/** True while any modal (checkout confirmation, dialogs, sheets) is open. */
function isAnyDialogOpen(): boolean {
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [data-slot="sheet-content"][data-state="open"]'
    )
  );
}

const OxEcosystemFAB = ({
  logisticsEnabled = true,
  servicesUrl = "https://ox-services.lovable.app",
}: OxEcosystemFABProps) => {
  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches
  );
  // Inline bottom offset (px) measured from docked bottom controls; null = baseline.
  const [bottomOffset, setBottomOffset] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = () => {
      setIsMobile(mq.matches);
      setBottomOffset(null);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Re-measure whenever the route or viewport size changes, even while closed,
  // so the FAB itself never sits on top of a bottom bar.
  useEffect(() => {
    if (!isMobile) {
      setBottomOffset(null);
      return;
    }
    const apply = () => {
      const lift = measureBottomDockedTop(containerRef.current);
      setBottomOffset(lift > 0 ? `${lift}px` : null);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [isMobile, location.pathname]);

  // While open on mobile: clear docked controls, pad the page so bottom-of-page
  // checkout buttons (e.g. Buy Now) scroll above the pills, and close the menu
  // as soon as a modal dialog opens so pills can never cover its controls.
  useEffect(() => {
    if (!open || !isMobile) return;

    const apply = () => {
      const lift = measureBottomDockedTop(containerRef.current);
      setBottomOffset(lift > 0 ? `${lift}px` : null);
      requestAnimationFrame(() => {
        const stackHeight = containerRef.current?.offsetHeight ?? 0;
        const occluded = Math.ceil(lift + stackHeight + BAR_GAP_PX);
        if (occluded > 0) document.body.style.paddingBottom = `${occluded}px`;
      });
    };

    apply();

    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (isAnyDialogOpen()) {
        setOpen(false);
        return;
      }
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        apply();
      });
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-state"],
    });
    window.addEventListener("resize", apply);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", apply);
      document.body.style.paddingBottom = "";
      setBottomOffset(null);
    };
  }, [open, isMobile]);

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
    {
      id: "services",
      label: "OX Services",
      icon: <Wrench className="h-5 w-5" />,
      color: "#0EA5E9",
      action: () => {
        window.open(servicesUrl, "_blank", "noopener,noreferrer");
        setOpen(false);
      },
    },
  ];

  const containerStyle: CSSProperties = {};
  if (isMobile) containerStyle.bottom = bottomOffset ?? BASE_BOTTOM;

  return (
    <div
      ref={containerRef}
      style={containerStyle}
      className={cn(
        "fixed right-4 sm:right-6 z-[60] flex flex-col items-end gap-3",
        !isMobile && "sm:bottom-6"
      )}
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
            <span className="text-base font-bold tracking-tight animate-scale-in">OX</span>
          )}
        </span>
      </button>
    </div>
  );
};

export default OxEcosystemFAB;
