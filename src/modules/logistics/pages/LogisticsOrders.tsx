import { Package } from "lucide-react";
import LogisticsHeader from "../components/LogisticsHeader";
import LogisticsBottomNav from "../components/LogisticsBottomNav";

const LogisticsOrders = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      <LogisticsHeader location="Sandton" />
      <main className="container max-w-2xl px-3 sm:px-4 py-12 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Package className="w-8 h-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold mb-2">No shipments yet</h1>
        <p className="text-muted-foreground">
          Your booked deliveries and quote requests will appear here.
        </p>
      </main>
      <LogisticsBottomNav />
    </div>
  );
};

export default LogisticsOrders;
