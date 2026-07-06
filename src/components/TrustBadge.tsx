import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type TrustBadgeVariant = "pill" | "icon";
type TrustBadgeColor = "success" | "accent" | "primary" | "accent-bold" | "primary-bold" | "success-bold";

interface TrustBadgeProps {
  variant?: TrustBadgeVariant;
  color?: TrustBadgeColor;
  icon: LucideIcon;
  label: string;
  className?: string;
  iconSize?: "sm" | "md" | "lg" | "xl";
}

const colorMap: Record<TrustBadgeColor, string> = {
  success: "bg-success/10 border-success/30 text-success",
  accent: "bg-accent/10 border-accent/20 text-accent",
  primary: "bg-primary/10 border-primary/20 text-primary",
  "accent-bold": "bg-accent/20 border-accent/30 text-accent-foreground",
  "primary-bold": "bg-primary/20 border-primary/30 text-primary-foreground",
  "success-bold": "bg-success/20 border-success/30 text-success-foreground",
};

const iconSizeMap: Record<string, string> = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-12 h-12",
  xl: "w-24 h-24",
};

const containerSizeMap: Record<string, string> = {
  sm: "w-8 h-8",
  md: "w-12 h-12",
  lg: "w-24 h-24",
  xl: "w-48 h-48",
};

export function TrustBadge({
  variant = "pill",
  color = "success",
  icon: Icon,
  label,
  className,
  iconSize = variant === "pill" ? "sm" : "xl",
}: TrustBadgeProps) {
  if (variant === "pill") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full border",
          colorMap[color],
          className
        )}
      >
        <Icon className={iconSizeMap[iconSize]} />
        <span className="text-sm font-medium">{label}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center",
        containerSizeMap[iconSize] || containerSizeMap.xl,
        colorMap[color],
        className
      )}
    >
      <Icon
        className={iconSizeMap[iconSize] || iconSizeMap.xl}
        strokeWidth={1.5}
      />
    </div>
  );
}

export default TrustBadge;
