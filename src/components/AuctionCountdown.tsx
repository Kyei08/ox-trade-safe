import { useState, useEffect } from "react";
import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuctionCountdownProps {
  endTime: string;
  onAuctionEnd?: () => void;
}

export default function AuctionCountdown({ endTime, onAuctionEnd }: AuctionCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    ended: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const distance = end - now;

      if (distance < 0) {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true });
        onAuctionEnd?.();
        return true;
      }

      setTimeRemaining({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
        ended: false,
      });
      return false;
    };

    calculateTime();
    const interval = setInterval(() => {
      if (calculateTime()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, onAuctionEnd]);

  const isUrgent = !timeRemaining.ended && 
    timeRemaining.days === 0 && 
    timeRemaining.hours < 1;

  const isEnding = !timeRemaining.ended && 
    timeRemaining.days === 0 && 
    timeRemaining.hours < 24;

  if (timeRemaining.ended) {
    return (
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg border border-border">
        <Clock className="h-6 w-6 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">Auction Status</p>
          <p className="text-xl font-bold text-foreground">Ended</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-colors",
        isUrgent 
          ? "bg-destructive/10 border-destructive animate-pulse" 
          : isEnding 
            ? "bg-warning/10 border-warning" 
            : "bg-muted border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        {isUrgent ? (
          <AlertTriangle className="h-5 w-5 text-destructive" />
        ) : (
          <Clock className="h-5 w-5 text-muted-foreground" />
        )}
        <span className={cn(
          "text-sm font-medium",
          isUrgent ? "text-destructive" : "text-muted-foreground"
        )}>
          {isUrgent ? "Ending Soon!" : "Time Remaining"}
        </span>
      </div>
      
      <div className="grid grid-cols-4 gap-2 text-center">
        <TimeUnit value={timeRemaining.days} label="Days" isUrgent={isUrgent} />
        <TimeUnit value={timeRemaining.hours} label="Hours" isUrgent={isUrgent} />
        <TimeUnit value={timeRemaining.minutes} label="Min" isUrgent={isUrgent} />
        <TimeUnit value={timeRemaining.seconds} label="Sec" isUrgent={isUrgent} />
      </div>
    </div>
  );
}

function TimeUnit({ value, label, isUrgent }: { value: number; label: string; isUrgent: boolean }) {
  return (
    <div className={cn(
      "p-2 rounded-md",
      isUrgent ? "bg-destructive/20" : "bg-background"
    )}>
      <p className={cn(
        "text-2xl font-bold tabular-nums",
        isUrgent ? "text-destructive" : "text-foreground"
      )}>
        {String(value).padStart(2, "0")}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
