import { Link, useLocation } from "react-router-dom";
import { Send, Package, Star } from "lucide-react";

const items = [
  { to: "/logistics", label: "Move", icon: Send, accent: true },
  { to: "/logistics/orders", label: "Orders", icon: Package },
  { to: "/logistics/account", label: "Account", icon: Star },
];

const LogisticsBottomNav = () => {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3">
        {items.map(({ to, label, icon: Icon, accent }) => {
          const active = pathname === to;
          const color = active ? (accent ? "text-accent" : "text-primary") : "text-muted-foreground";
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center gap-1 py-3 text-[11px] font-bold tracking-wider uppercase ${color}`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default LogisticsBottomNav;
