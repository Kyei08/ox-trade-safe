import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Trophy, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface AuctionStatusProps {
  status: string;
  currentBid: number | null;
  reservePrice: number | null;
  winnerId?: string | null;
  currentUserId?: string;
  isOwner: boolean;
}

export default function AuctionStatus({
  status,
  currentBid,
  reservePrice,
  winnerId,
  currentUserId,
  isOwner,
}: AuctionStatusProps) {
  const reserveMet = !reservePrice || (currentBid && currentBid >= reservePrice);
  const isWinner = winnerId && winnerId === currentUserId;

  // Show reserve price status for active auctions
  if (status === "active" && reservePrice) {
    return (
      <div className="flex items-center gap-2">
        {reserveMet ? (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle className="h-3 w-3 mr-1" />
            Reserve Met
          </Badge>
        ) : (
          <Badge variant="secondary">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Reserve Not Met
          </Badge>
        )}
      </div>
    );
  }

  // Show winner status for ended/sold auctions
  if (status === "sold") {
    if (isWinner) {
      return (
        <Alert className="border-primary bg-primary/10">
          <Trophy className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Congratulations!</AlertTitle>
          <AlertDescription>
            You won this auction! The seller will contact you to arrange payment and delivery.
          </AlertDescription>
        </Alert>
      );
    }

    if (isOwner) {
      return (
        <Alert className="border-primary bg-primary/10">
          <CheckCircle className="h-4 w-4 text-primary" />
          <AlertTitle className="text-primary">Auction Sold</AlertTitle>
          <AlertDescription>
            Your auction has ended with a winning bid. Contact the winner to arrange the transaction.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertTitle>Auction Ended</AlertTitle>
        <AlertDescription>
          This auction has been sold to another bidder.
        </AlertDescription>
      </Alert>
    );
  }

  // Show expired status
  if (status === "expired") {
    if (isOwner) {
      return (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Auction Expired</AlertTitle>
          <AlertDescription>
            {reservePrice && !reserveMet
              ? "The reserve price was not met. You can relist this item."
              : "No bids were placed on this auction. You can relist this item."}
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <Alert>
        <XCircle className="h-4 w-4" />
        <AlertTitle>Auction Expired</AlertTitle>
        <AlertDescription>
          This auction ended without a sale.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
