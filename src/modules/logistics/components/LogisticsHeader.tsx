import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MapPin, LogIn, ChevronDown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  location: string;
  onLocationClick?: () => void;
}

const LogisticsHeader = ({ location, onLocationClick }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
      <div className="container px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-3">
        <Link to="/logistics" className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary-foreground">OX</span>
          </div>
          <span className="text-lg font-bold truncate">Logistics</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLocationClick}
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold"
          >
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="max-w-[120px] truncate">{location}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          {!user && (
            <Button
              onClick={() => navigate("/auth")}
              className="bg-accent hover:bg-accent/90 text-accent-foreground gap-2 font-semibold"
            >
              <LogIn className="w-4 h-4" />
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default LogisticsHeader;
