import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, LogIn, ChevronDown, Store } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  location: string;
  onLocationClick?: () => void;
}

const LogisticsHeader = ({ location, onLocationClick }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border pt-[env(safe-area-inset-top)]">
      <div className="container px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2">
        <Link
          to="/logistics"
          aria-label="OX Logistics home"
          className="flex items-center gap-2 min-w-0 shrink rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary-foreground">OX</span>
          </div>
          <span className="text-base sm:text-lg font-bold truncate">Logistics</span>
        </Link>

        <nav aria-label="Logistics header" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-11"
          >
            <Store className="w-4 h-4" aria-hidden="true" />
            <span>Marketplace</span>
          </Link>
          <Link
            to="/"
            aria-label="Back to Marketplace"
            className="sm:hidden inline-flex items-center justify-center rounded-lg border border-border bg-card h-11 w-11 hover:bg-accent hover:text-accent-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Store className="w-4 h-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={onLocationClick}
            aria-label={`Change location, current ${location}`}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 sm:px-3 h-11 sm:py-2 text-xs sm:text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="max-w-[80px] sm:max-w-[120px] truncate">{location}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
          </button>
          {!user && (
            <Button
              onClick={() => navigate("/auth")}
              size="sm"
              aria-label="Sign in"
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-1.5 font-semibold h-11 px-2.5 sm:px-3"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span className="hidden xs:inline sm:inline">Sign in</span>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
};

export default LogisticsHeader;
