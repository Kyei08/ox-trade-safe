import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Zap, TrendingUp, Rocket } from "lucide-react";

const plans = [
  {
    name: "Cheap",
    icon: Zap,
    price: "R0",
    period: "Forever free",
    description: "Perfect for casual sellers",
    features: [
      "Basic listings",
      "Standard search visibility",
      "Community support",
      "Basic analytics",
      "Up to 10 active listings",
    ],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Standard",
    icon: TrendingUp,
    price: "R50",
    period: "/month",
    description: "For regular sellers",
    features: [
      "Everything in Cheap",
      "Promoted listings",
      "Priority placement",
      "Advanced analytics",
      "Unlimited listings",
      "Email notifications",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "OX Pro",
    icon: Rocket,
    price: "R400",
    period: "/month",
    description: "For serious businesses",
    features: [
      "Everything in Standard",
      "Verified business profile",
      "Bulk uploads",
      "Top placement priority",
      "Real-time sales analytics",
      "Dedicated support",
      "Custom branding",
      "API access",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const PricingSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Start free, upgrade when you need more. Plus 2-5% transaction fees on successful sales.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <Card
                key={index}
                className={`relative p-8 hover:shadow-glow transition-all duration-300 ${
                  plan.popular ? "border-2 border-accent shadow-card scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-accent text-accent-foreground rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? "hero" : "default"}
                  className="w-full"
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground">
            All plans include secure escrow payments and KYC verification.{" "}
            <a href="#" className="text-primary hover:underline font-medium">
              Compare features →
            </a>
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
