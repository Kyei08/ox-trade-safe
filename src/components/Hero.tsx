import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Lock, BadgeCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-auction.jpg";

const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="OX Marketplace - Secure Auction Platform" 
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/95 to-primary/80" />
      </div>

      {/* Content */}
      <div className="container relative z-10 px-4 py-20">
        <div className="max-w-4xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/30 text-accent-foreground mb-6">
            <Shield className="w-4 h-4" />
            <span className="text-sm font-medium">South Africa's Most Trusted Marketplace</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground mb-6 leading-tight">
            Buy. Bid. Sell. <br />
            <span className="text-accent">Securely.</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            South Africa's premier auction and classifieds platform. Trade with confidence using KYC verification and escrow payments.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button size="lg" variant="hero" className="text-lg px-8" onClick={() => navigate("/auth")}>
              Start Bidding Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" className="text-lg px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>
              How It Works
            </Button>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3 text-primary-foreground/90">
              <BadgeCheck className="w-6 h-6 text-success" />
              <span className="font-medium">KYC Verified</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-primary-foreground/90">
              <Lock className="w-6 h-6 text-success" />
              <span className="font-medium">Escrow Protected</span>
            </div>
            <div className="flex items-center justify-center gap-3 text-primary-foreground/90">
              <Shield className="w-6 h-6 text-success" />
              <span className="font-medium">100% Secure</span>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  );
};

export default Hero;
