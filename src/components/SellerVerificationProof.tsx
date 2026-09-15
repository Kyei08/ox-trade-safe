import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Check, Lock, Building2 } from "lucide-react";
import { format } from "date-fns";

const DOC_LABELS: Record<string, string> = {
  id_document_path: "South African ID verified",
  selfie_path: "Selfie identity check passed",
  proof_of_residence_path: "Proof of residence verified",
  cipc_document_path: "CIPC company registration verified",
  representative_id_path: "Representative ID verified",
  proof_of_business_address_path: "Business address verified",
  proof_of_business_banking_path: "Business banking verified",
};

interface Proof {
  seller_type: "individual" | "business" | null;
  verified_at: string | null;
  company_name: string | null;
  document_keys: string[] | null;
}

const SellerVerificationProof = ({ sellerId }: { sellerId: string }) => {
  const [proof, setProof] = useState<Proof | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any).rpc("get_seller_verification_proof", {
        _seller_id: sellerId,
      });
      if (active) setProof((data as Proof[] | null)?.[0] ?? null);
    })();
    return () => {
      active = false;
    };
  }, [sellerId]);

  if (!proof) return null;

  const checks = (proof.document_keys || [])
    .map((k) => DOC_LABELS[k])
    .filter(Boolean);

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Verification proof
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1">
            {proof.seller_type === "business" ? (
              <>
                <Building2 className="h-3 w-3" /> Verified Business
              </>
            ) : (
              <>
                <ShieldCheck className="h-3 w-3" /> Verified Seller
              </>
            )}
          </Badge>
          {proof.company_name && (
            <span className="text-sm text-muted-foreground">{proof.company_name}</span>
          )}
          {proof.verified_at && (
            <span className="text-sm text-muted-foreground">
              Approved {format(new Date(proof.verified_at), "d MMM yyyy")}
            </span>
          )}
        </div>

        {checks.length > 0 && (
          <ul className="space-y-2">
            {checks.map((label) => (
              <li key={label} className="flex items-center gap-2 text-sm text-foreground">
                <Check className="h-4 w-4 text-primary shrink-0" />
                {label}
              </li>
            ))}
          </ul>
        )}

        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Documents were checked by our review team. For the seller's safety, the files
          themselves stay private and are never shown to buyers.
        </p>
      </CardContent>
    </Card>
  );
};

export default SellerVerificationProof;
