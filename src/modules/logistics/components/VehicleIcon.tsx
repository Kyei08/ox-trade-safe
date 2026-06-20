import { Bike, Car, Truck } from "lucide-react";
import type { Vehicle } from "../data/mockProviders";

const VehicleIcon = ({ vehicle, className }: { vehicle: Vehicle; className?: string }) => {
  switch (vehicle) {
    case "Bike":
      return <Bike className={className} />;
    case "Car":
      return <Car className={className} />;
    case "Van":
    case "Bakkie":
    case "Truck":
      return <Truck className={className} />;
  }
};

export default VehicleIcon;
