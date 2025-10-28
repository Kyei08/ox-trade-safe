import { Smartphone, Laptop, Home, Car, Shirt, Gem, Package, Briefcase } from "lucide-react";
import { Card } from "@/components/ui/card";

const categories = [
  { icon: Smartphone, name: "Electronics", count: "2.3k" },
  { icon: Laptop, name: "Computers", count: "1.8k" },
  { icon: Car, name: "Vehicles", count: "1.2k" },
  { icon: Home, name: "Home & Garden", count: "3.5k" },
  { icon: Shirt, name: "Fashion", count: "4.1k" },
  { icon: Gem, name: "Collectibles", count: "890" },
  { icon: Briefcase, name: "Business", count: "650" },
  { icon: Package, name: "Other", count: "2.7k" },
];

const Categories = () => {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Browse Categories</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover thousands of items across all categories
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Card
                key={index}
                className="p-6 hover:shadow-card transition-all duration-300 cursor-pointer hover:-translate-y-1 group"
              >
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{category.name}</h3>
                    <p className="text-sm text-muted-foreground">{category.count} items</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Categories;
