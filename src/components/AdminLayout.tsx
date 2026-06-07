import { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import Header from "@/components/Header";
import { LayoutDashboard, ShieldCheck, Flag, FolderTree } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/kyc", label: "KYC", icon: ShieldCheck },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
];

interface AdminLayoutProps {
  title?: string;
  description?: string;
  children: ReactNode;
}

const AdminLayout = ({ title, description, children }: AdminLayoutProps) => {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pt-20 pb-12">
        <div className="container px-4">
          <div className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold">Admin</h1>
            <p className="text-sm text-muted-foreground">
              Manage trust & safety, content, and platform configuration.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar / horizontal nav */}
            <aside className="lg:w-56 shrink-0">
              <nav
                aria-label="Admin navigation"
                className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-4 px-4 lg:mx-0 lg:px-0 pb-2 lg:pb-0"
              >
                {navItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )
                    }
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </NavLink>
                ))}
              </nav>
            </aside>

            {/* Content */}
            <section className="flex-1 min-w-0">
              {(title || description) && (
                <div className="mb-6">
                  {title && <h2 className="text-xl md:text-2xl font-bold">{title}</h2>}
                  {description && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
              )}
              {children}
            </section>
          </div>
        </div>
      </main>
    </>
  );
};

export default AdminLayout;
