export type Coverage = "Local" | "City" | "Provincial" | "National";
export type Availability = "Available Today" | "Available Tomorrow" | "Busy";
export type Vehicle = "Bike" | "Car" | "Van" | "Bakkie" | "Truck";
export type ProviderType =
  | "Courier"
  | "Logistics"
  | "Truck Operator"
  | "Furniture Mover"
  | "Bakkie Service";
export type Capability =
  | "Documents"
  | "Food"
  | "Furniture"
  | "Appliances"
  | "Electronics"
  | "Fragile Items"
  | "Bulk Goods";

export interface Provider {
  id: string;
  name: string;
  type: ProviderType;
  rating: number;
  reviews: number;
  priceFrom?: number;
  priceMode: "fixed" | "from" | "quote";
  etaMinutes?: number;
  etaLabel?: string;
  availability: Availability;
  /** ISO timestamp of when the courier was last marked Available now. */
  lastAvailableAt?: string;
  /** ISO timestamp estimating when the courier will next be available. */
  availableAgainAt?: string;
  coverage: Coverage;
  vehicle: Vehicle;
  capabilities: Capability[];
  servesYourArea: boolean;
  description?: string;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();
const inMinutes = (m: number) => new Date(Date.now() + m * 60 * 1000).toISOString();
const inHours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000).toISOString();

export const mockProviders: Provider[] = [
  {
    id: "p1",
    name: "RapidDoc Express",
    type: "Courier",
    rating: 5.0,
    reviews: 45,
    priceFrom: 125,
    priceMode: "from",
    etaLabel: "30 min",
    availability: "Busy",
    lastAvailableAt: hoursAgo(3),
    availableAgainAt: inMinutes(45),
    coverage: "Local",
    vehicle: "Bike",
    capabilities: ["Documents", "Food"],
    servesYourArea: true,
  },
  {
    id: "p2",
    name: "Prime Courier ZA",
    type: "Courier",
    rating: 4.7,
    reviews: 2412,
    priceFrom: 1420,
    priceMode: "fixed",
    etaLabel: "1 hr",
    availability: "Available Today",
    coverage: "National",
    vehicle: "Van",
    capabilities: ["Documents", "Electronics", "Fragile Items"],
    servesYourArea: true,
    description: "Insured, tracked, signed-for delivery countrywide.",
  },
  {
    id: "p3",
    name: "Highveld Haulage",
    type: "Truck Operator",
    rating: 4.6,
    reviews: 89,
    priceMode: "quote",
    etaLabel: "on quote",
    availability: "Available Today",
    coverage: "National",
    vehicle: "Truck",
    capabilities: ["Bulk Goods", "Appliances"],
    servesYourArea: true,
    description: "Heavy loads, building materials, palletised freight.",
  },
  {
    id: "p4",
    name: "Sandton Swift Van",
    type: "Logistics",
    rating: 4.5,
    reviews: 211,
    priceFrom: 480,
    priceMode: "from",
    etaLabel: "1 hr",
    availability: "Available Today",
    coverage: "City",
    vehicle: "Van",
    capabilities: ["Electronics", "Furniture", "Fragile Items"],
    servesYourArea: true,
  },
  {
    id: "p5",
    name: "Cape Movers Co.",
    type: "Furniture Mover",
    rating: 4.8,
    reviews: 312,
    priceMode: "quote",
    etaLabel: "on quote",
    availability: "Available Tomorrow",
    lastAvailableAt: daysAgo(1),
    availableAgainAt: inHours(18),
    coverage: "Provincial",
    vehicle: "Truck",
    capabilities: ["Furniture", "Appliances", "Fragile Items"],
    servesYourArea: false,
    description: "Full house & office moves. Trained crew, blankets, lift gates.",
  },
  {
    id: "p6",
    name: "Joburg Bakkie Brothers",
    type: "Bakkie Service",
    rating: 4.4,
    reviews: 158,
    priceFrom: 350,
    priceMode: "from",
    etaLabel: "45 min",
    availability: "Available Today",
    coverage: "City",
    vehicle: "Bakkie",
    capabilities: ["Furniture", "Appliances", "Bulk Goods"],
    servesYourArea: true,
  },
];
