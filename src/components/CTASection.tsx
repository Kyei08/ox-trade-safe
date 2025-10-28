import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-gradient-hero relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-glow rounded-full blur-3xl" />
      </div>

      <div className="container px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/30 text-accent-foreground mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Join 50,000+ Verified Users</span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Ready to Start Trading?
          </h2>
          
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Create your free account today and discover why thousands of South Africans trust OX for their online trading.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button size="lg" variant="hero" className="text-lg px-8" onClick={() => navigate("/auth")}>
              Create Free Account
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
              Browse Listings
            </Button>
          </div>

          <p className="mt-6 text-sm text-primary-foreground/70">
            No credit card required • Free to start • Upgrade anytime
          </p>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
