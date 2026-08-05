import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Flag, FolderTree, Users, Package } from "lucide-react";

interface Stats {
  pendingVerifications: number;
  pendingReports: number;
  categories: number;
  listings: number;
  users: number;
}

const AdminDashboard = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
      return;
    }
    if (!user) return;

    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const admin = roles?.some((r) => r.role === "admin") ?? false;
      setIsAdmin(admin);
      if (!admin) {
        setLoading(false);
        return;
      }

      const [verifications, reports, cats, listings, profiles] = await Promise.all([
        supabase.from("seller_verifications").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
        supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("categories").select("*", { count: "exact", head: true }),
        supabase.from("listings").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        pendingVerifications: verifications.count ?? 0,
        pendingReports: reports.count ?? 0,
        categories: cats.count ?? 0,
        listings: listings.count ?? 0,
        users: profiles.count ?? 0,
      });
      setLoading(false);
    })();
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <AdminLayout>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AdminLayout>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            You don't have access to this page.
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const cards = [
    { label: "Pending Verifications", value: stats?.pendingVerifications ?? 0, icon: ShieldCheck, to: "/admin/sellers" },
    { label: "Pending Reports", value: stats?.pendingReports ?? 0, icon: Flag, to: "/admin/reports" },
    { label: "Categories", value: stats?.categories ?? 0, icon: FolderTree, to: "/admin/categories" },
    { label: "Listings", value: stats?.listings ?? 0, icon: Package, to: "/listings" },
    { label: "Users", value: stats?.users ?? 0, icon: Users, to: "/admin" },
  ];

  return (
    <AdminLayout title="Overview" description="Quick snapshot of platform activity">
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, to }) => (
          <Link key={label} to={to}>
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <Icon className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
