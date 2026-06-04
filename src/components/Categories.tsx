import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Smartphone,
  Laptop,
  Home,
  Car,
  Shirt,
  Gem,
  Package,
  Briefcase,
  Sprout,
  Building2,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

// Map icon name strings (stored in DB) to lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  Smartphone,
  Laptop,
  Home,
  Car,
  Shirt,
  Gem,
  Package,
  Briefcase,
  Sprout,
  Building2,
};

interface Category {
  id: string;
  name: string;
  icon: string | null;
  listing_count: number | null;
}

const Categories = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name, icon, listing_count")
        .order("name", { ascending: true });
      if (data) setCategories(data);
      setLoading(false);
    };
    fetchCategories();
  }, []);

  return (
    <section id="categories" className="py-20 bg-secondary/30">
      <div className="container px-4">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Browse Categories</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Discover thousands of items across all categories
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
          {loading
            ? [...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))
            : categories.map((category) => {
                const Icon = (category.icon && ICON_MAP[category.icon]) || Package;
                return (
                  <Card
                    key={category.id}
                    className="p-6 hover:shadow-card transition-all duration-300 cursor-pointer hover:-translate-y-1 group"
                    onClick={() => navigate(`/listings?category=${category.id}`)}
                  >
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-8 h-8 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{category.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {category.listing_count ?? 0} items
                        </p>
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
