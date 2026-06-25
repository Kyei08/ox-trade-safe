import { Link, useLocation } from "react-router-dom";
import { Send, Package, Star, Truck } from "lucide-react";

const items = [
  { to: "/logistics", label: "Move", icon: Send, accent: true },
  { to: "/logistics/orders", label: "Orders", icon: Package },
  { to: "/logistics/become-courier", label: "Drive", icon: Truck },
  { to: "/logistics/account", label: "Account", icon: Star },
];

const LogisticsBottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Logistics primary"
      className="fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon, accent }) => {
          const active = pathname === to;
          const color = active ? (accent ? "text-accent" : "text-primary") : "text-muted-foreground";
          return (
            <li key={to}>
              <Link
                to={to}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center justify-center gap-1 py-2 min-h-[56px] min-w-[44px] text-[10px] font-bold tracking-wider uppercase active:bg-muted/50 hover:bg-muted/40 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-md ${color}`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="truncate max-w-full px-1">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default LogisticsBottomNav;
