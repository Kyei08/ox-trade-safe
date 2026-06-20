import { Link, useLocation } from "react-router-dom";
import { Store, Truck, Sparkles } from "lucide-react";

const items = [
  { to: "/", label: "Marketplace", icon: Store, match: (p: string) => !p.startsWith("/logistics") },
  { to: "/logistics", label: "Logistics", icon: Truck, match: (p: string) => p.startsWith("/logistics") },
  { to: "#", label: "Services", icon: Sparkles, disabled: true, match: () => false },
];

const EcosystemNav = () => {
  const { pathname } = useLocation();
  return (
    <div className="hidden md:flex items-center gap-1 rounded-full bg-muted p-1">
      {items.map(({ to, label, icon: Icon, disabled, match }) => {
        const active = match(pathname);
        const className = `flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
          active
            ? "bg-background text-foreground shadow-sm"
            : disabled
            ? "text-muted-foreground/60 cursor-not-allowed"
            : "text-muted-foreground hover:text-foreground"
        }`;
        if (disabled) {
          return (
            <span key={label} className={className} aria-disabled>
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className="ml-1 text-[9px] uppercase tracking-wider opacity-60">Soon</span>
            </span>
          );
        }
        return (
          <Link key={label} to={to} className={className}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
};

export default EcosystemNav;
