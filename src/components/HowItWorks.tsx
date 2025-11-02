import { UserCheck, Search, Gavel, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";

const steps = [
  {
    icon: UserCheck,
    title: "Create Account",
    description: "Sign up and complete KYC verification for secure trading",
    step: "01",
  },
  {
    icon: Search,
    title: "Browse & Find",
    description: "Explore thousands of verified listings or create your own",
    step: "02",
  },
  {
    icon: Gavel,
    title: "Bid or Buy",
    description: "Place bids on auctions or purchase at fixed prices",
    step: "03",
  },
  {
    icon: CreditCard,
    title: "Secure Payment",
    description: "Complete transactions with escrow-protected payments",
    step: "04",
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 bg-background">
      <div className="container px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">How OX Works</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Simple, secure, and transparent trading in four easy steps
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative">
                <Card className="p-8 h-full hover:shadow-card transition-all duration-300 relative overflow-hidden">
                  {/* Step Number Background */}
                  <div className="absolute top-4 right-4 text-8xl font-bold text-muted/10">
                    {step.step}
                  </div>
                  
                  <div className="relative z-10">
                    <div className="w-16 h-16 rounded-full bg-gradient-hero flex items-center justify-center mb-6">
                      <Icon className="w-8 h-8 text-primary-foreground" />
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </Card>
                
                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-border" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
