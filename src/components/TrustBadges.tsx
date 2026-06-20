import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Building2, Phone, MapPin, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrustBadgesProfile {
  seller_type?: "individual" | "business" | null;
  seller_verification_status?: string | null;
  phone_verified_at?: string | null;
  address_verified_at?: string | null;
  is_courier?: boolean | null;
}

interface Props {
  profile: TrustBadgesProfile;
  className?: string;
  size?: "sm" | "md";
}

const TrustBadges = ({ profile, className, size = "md" }: Props) => {
  const approved = profile.seller_verification_status === "approved";
  const isBusiness = profile.seller_type === "business";

  const badges: { label: string; icon: typeof ShieldCheck; show: boolean; className: string }[] = [
    {
      label: "Verified Seller",
      icon: ShieldCheck,
      show: approved && !isBusiness,
      className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    },
    {
      label: "Verified Business",
      icon: Building2,
      show: approved && isBusiness,
      className: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    },
    {
      label: "Verified Courier",
      icon: Truck,
      show: !!profile.is_courier,
      className: "bg-orange-500/10 text-orange-700 border-orange-500/30",
    },
    {
      label: "Phone Verified",
      icon: Phone,
      show: !!profile.phone_verified_at,
      className: "bg-violet-500/10 text-violet-700 border-violet-500/30",
    },
    {
      label: "Address Verified",
      icon: MapPin,
      show: !!profile.address_verified_at,
      className: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    },
  ];

  const visible = badges.filter((b) => b.show);
  if (visible.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {visible.map(({ label, icon: Icon, className: bc }) => (
        <Badge
          key={label}
          variant="outline"
          className={cn(
            "gap-1 font-medium",
            size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs",
            bc
          )}
        >
          <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
          {label}
        </Badge>
      ))}
    </div>
  );
};

export default TrustBadges;
