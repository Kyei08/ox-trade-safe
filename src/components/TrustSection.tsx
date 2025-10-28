import { Shield, Lock, BadgeCheck, Users, Award, HeartHandshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import trustBadge from "@/assets/trust-badge.png";

const trustFeatures = [
  {
    icon: Shield,
    title: "KYC Verification",
    description: "All users verified through secure identity checks",
  },
  {
    icon: Lock,
    title: "Escrow Protection",
    description: "Payments held securely until both parties are satisfied",
  },
  {
    icon: BadgeCheck,
    title: "Verified Sellers",
    description: "Business sellers receive verified badges and premium features",
  },
  {
    icon: Users,
    title: "Community Ratings",
    description: "Transparent feedback system builds trust",
  },
  {
    icon: Award,
    title: "Quality Guarantee",
    description: "AI-powered moderation ensures listing quality",
  },
  {
    icon: HeartHandshake,
    title: "Dispute Resolution",
    description: "Fair mediation process protects all parties",
  },
];

const TrustSection = () => {
  return (
    <section className="py-20 bg-gradient-to-b from-secondary/30 to-background">
      <div className="container px-4">
        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-7xl mx-auto">
          {/* Left: Trust Badge & Stats */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/30 text-success mb-6">
              <Shield className="w-4 h-4" />
              <span className="text-sm font-medium">Built on Trust</span>
            </div>
            
            <h2 className="text-4xl font-bold mb-6">
              Trade with Complete Confidence
            </h2>
            
            <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
              Unlike other marketplaces, OX prioritizes your security with comprehensive verification, escrow payments, and transparent ratings.
            </p>

            <div className="flex justify-center lg:justify-start mb-8">
              <img 
                src={trustBadge} 
                alt="Trust and Security Badge" 
                className="w-48 h-48 object-contain"
              />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto lg:mx-0">
              <div className="text-center p-4 bg-card rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-primary mb-1">100%</div>
                <div className="text-sm text-muted-foreground">Secure</div>
              </div>
              <div className="text-center p-4 bg-card rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-primary mb-1">50k+</div>
                <div className="text-sm text-muted-foreground">Verified Users</div>
              </div>
              <div className="text-center p-4 bg-card rounded-lg shadow-sm">
                <div className="text-3xl font-bold text-primary mb-1">4.8★</div>
                <div className="text-sm text-muted-foreground">Rating</div>
              </div>
            </div>
          </div>

          {/* Right: Trust Features */}
          <div className="grid sm:grid-cols-2 gap-4">
            {trustFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="p-6 hover:shadow-card transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustSection;
