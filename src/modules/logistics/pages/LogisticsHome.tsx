import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import LogisticsHeader from "../components/LogisticsHeader";
import LogisticsBottomNav from "../components/LogisticsBottomNav";
import PickupDropoffCard from "../components/PickupDropoffCard";
import ItemCategoryGrid, { type ItemCategory } from "../components/ItemCategoryGrid";
import SizeUrgencySelectors, { type ItemSize, type Urgency } from "../components/SizeUrgencySelectors";
import NotesPhotosDimensions from "../components/NotesPhotosDimensions";

const LogisticsHome = () => {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState("Sandton, Johannesburg");
  const [dropoff, setDropoff] = useState("Pretoria Central, Tshwane");
  const [category, setCategory] = useState<ItemCategory | null>("Furniture");
  const [size, setSize] = useState<ItemSize>("Large");
  const [urgency, setUrgency] = useState<Urgency>("Same Day");

  const findProviders = () => {
    const params = new URLSearchParams({
      pickup,
      dropoff,
      ...(category ? { category } : {}),
      size,
      urgency,
    });
    navigate(`/logistics/providers?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <LogisticsHeader location="Sandton" />
      <main className="container max-w-2xl px-3 sm:px-4 py-5 sm:py-6 space-y-5">
        <PickupDropoffCard
          pickup={pickup}
          dropoff={dropoff}
          onPickupChange={setPickup}
          onDropoffChange={setDropoff}
        />
        <ItemCategoryGrid value={category} onChange={setCategory} />
        <SizeUrgencySelectors
          size={size}
          urgency={urgency}
          onSizeChange={setSize}
          onUrgencyChange={setUrgency}
        />
        <NotesPhotosDimensions />
        <Button
          onClick={findProviders}
          className="w-full h-12 text-base font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
        >
          Find providers
        </Button>
      </main>
      <LogisticsBottomNav />
    </div>
  );
};

export default LogisticsHome;
