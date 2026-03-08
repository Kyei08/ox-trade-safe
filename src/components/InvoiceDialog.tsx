import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FileText, Download, Printer } from "lucide-react";
import { formatZAR } from "@/lib/currency";
import { format } from "date-fns";

interface InvoiceData {
  invoiceNumber: string;
  orderDate: string;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  listingTitle: string;
  amount: number;
  deliveryOption?: string | null;
  status: string;
}

interface InvoiceDialogProps {
  data: InvoiceData;
  children?: React.ReactNode;
}

const DELIVERY_LABELS: Record<string, string> = {
  collect: "Collection",
  courier: "Courier Delivery",
  post: "Postal Service",
};

const InvoiceDialog = ({ data, children }: InvoiceDialogProps) => {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const content = invoiceRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${data.invoiceNumber}</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 40px; color: #1a1a1a; }
            .invoice { max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
            .logo { font-size: 32px; font-weight: 800; letter-spacing: -1px; }
            .logo-accent { color: #f97316; }
            .invoice-title { text-align: right; }
            .invoice-title h2 { font-size: 24px; margin: 0 0 8px; color: #666; text-transform: uppercase; letter-spacing: 2px; }
            .invoice-number { font-size: 14px; color: #888; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
            .detail-section h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin: 0 0 8px; }
            .detail-section p { margin: 4px 0; font-size: 14px; }
            .line-items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            .line-items th { text-align: left; padding: 12px 16px; border-bottom: 2px solid #e5e5e5; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #888; }
            .line-items td { padding: 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
            .line-items .amount { text-align: right; font-weight: 600; }
            .total-row { border-top: 2px solid #1a1a1a; }
            .total-row td { font-size: 18px; font-weight: 700; padding-top: 16px; }
            .footer { text-align: center; margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #888; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
            .status-paid { background: #dcfce7; color: #166534; }
            .status-other { background: #f3f4f6; color: #374151; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const statusClass = data.status === "paid" || data.status === "delivered" ? "status-paid" : "status-other";

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <FileText className="h-4 w-4 mr-1" />
            Invoice
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice {data.invoiceNumber}
          </DialogTitle>
        </DialogHeader>

        <div ref={invoiceRef}>
          <div className="invoice">
            {/* Header */}
            <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
              <div>
                <div className="logo" style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-1px" }}>
                  <span className="logo-accent" style={{ color: "#f97316" }}>OX</span> Trade
                </div>
                <p style={{ fontSize: "12px", color: "#888", marginTop: "4px" }}>South Africa's Marketplace</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <h2 style={{ fontSize: "20px", color: "#666", textTransform: "uppercase", letterSpacing: "2px", margin: "0 0 8px" }}>Invoice</h2>
                <p style={{ fontSize: "14px", color: "#888" }}>{data.invoiceNumber}</p>
                <span className={`status-badge ${statusClass}`} style={{
                  display: "inline-block",
                  padding: "4px 12px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  marginTop: "8px",
                  background: data.status === "paid" || data.status === "delivered" ? "#dcfce7" : "#f3f4f6",
                  color: data.status === "paid" || data.status === "delivered" ? "#166534" : "#374151",
                }}>
                  {data.status}
                </span>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Details */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "24px" }}>
              <div>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#888", marginBottom: "8px" }}>Bill To</h3>
                <p style={{ fontSize: "14px", fontWeight: 600, margin: "4px 0" }}>{data.buyerName}</p>
                <p style={{ fontSize: "14px", color: "#666", margin: "4px 0" }}>{data.buyerEmail}</p>
              </div>
              <div>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#888", marginBottom: "8px" }}>Seller</h3>
                <p style={{ fontSize: "14px", fontWeight: 600, margin: "4px 0" }}>{data.sellerName}</p>
                <h3 style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#888", marginBottom: "8px", marginTop: "16px" }}>Date</h3>
                <p style={{ fontSize: "14px", margin: "4px 0" }}>{format(new Date(data.orderDate), "dd MMMM yyyy")}</p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Line Items */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "12px 0", borderBottom: "2px solid #e5e5e5", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#888" }}>Description</th>
                  <th style={{ textAlign: "left", padding: "12px 0", borderBottom: "2px solid #e5e5e5", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#888" }}>Delivery</th>
                  <th style={{ textAlign: "right", padding: "12px 0", borderBottom: "2px solid #e5e5e5", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", color: "#888" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "16px 0", borderBottom: "1px solid #f0f0f0", fontSize: "14px" }}>{data.listingTitle}</td>
                  <td style={{ padding: "16px 0", borderBottom: "1px solid #f0f0f0", fontSize: "14px" }}>
                    {data.deliveryOption ? (DELIVERY_LABELS[data.deliveryOption] || data.deliveryOption) : "—"}
                  </td>
                  <td style={{ padding: "16px 0", borderBottom: "1px solid #f0f0f0", fontSize: "14px", textAlign: "right", fontWeight: 600 }}>{formatZAR(data.amount)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ padding: "16px 0", fontSize: "18px", fontWeight: 700, borderTop: "2px solid #1a1a1a" }}>Total</td>
                  <td style={{ padding: "16px 0", fontSize: "18px", fontWeight: 700, textAlign: "right", borderTop: "2px solid #1a1a1a" }}>{formatZAR(data.amount)}</td>
                </tr>
              </tbody>
            </table>

            {/* Footer */}
            <div style={{ textAlign: "center", marginTop: "32px", paddingTop: "16px", borderTop: "1px solid #e5e5e5", fontSize: "12px", color: "#888" }}>
              <p>Thank you for your purchase on OX Trade</p>
              <p>For support, contact us at support@oxtrade.co.za</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-4">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InvoiceDialog;
