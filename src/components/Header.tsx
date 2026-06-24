import { Button } from "@/components/ui/button";
import { Menu, Search, LogOut, MessageSquare, Home, Grid, Plus, User, Gavel, Shield, X, Truck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import EcosystemNav from "@/shared/EcosystemNav";

const Header = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  // Auto-close mobile sheet on route change
  const prevPath = useRef(location.pathname);
  useEffect(() => {
    if (prevPath.current !== location.pathname) {
      setMobileMenuOpen(false);
      prevPath.current = location.pathname;
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  const getInitials = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
          {/* Logo */}
          <div className="flex items-center gap-4 lg:gap-8 min-w-0">
            <Link to="/" className="flex items-center gap-2 min-w-0" aria-label="OX Marketplace home">
              <img
                src={oxLogo.url}
                alt="OX"
                className="h-9 sm:h-10 w-auto shrink-0 object-contain"
              />
              <span className="hidden sm:inline text-lg sm:text-xl font-bold truncate">Marketplace</span>
            </Link>


            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              <Link 
                to="/" 
                className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-2 ${location.pathname === "/" ? "font-bold" : ""}`}
              >
                <Home className="w-4 h-4" />
                Home
              </Link>
              <Link 
                to="/listings" 
                className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-2 ${location.pathname === "/listings" ? "font-bold" : ""}`}
              >
                <Grid className="w-4 h-4" />
                Browse Listings
              </Link>
              {user && (
                <>
                  <Link 
                    to="/create-listing" 
                    className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-2 ${location.pathname === "/create-listing" ? "font-bold" : ""}`}
                  >
                    <Plus className="w-4 h-4" />
                    Sell Item
                  </Link>
                  <Link 
                    to="/dashboard" 
                    className={`text-sm font-medium hover:text-primary transition-colors flex items-center gap-2 ${location.pathname === "/dashboard" ? "font-bold" : ""}`}
                  >
                    <User className="w-4 h-4" />
                    Dashboard
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            <EcosystemNav />
            <Button variant="ghost" size="icon" className="hidden sm:flex" aria-label="Search">
              <Search className="w-5 h-5" />
            </Button>
            
            {user ? (
              <>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="hidden sm:inline-flex"
                  onClick={() => navigate("/messages")}
                  aria-label="Messages"
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
                <Button 
                  variant="accent" 
                  className="hidden sm:flex"
                  onClick={() => navigate("/create-listing")}
                >
                  Start Selling
                </Button>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(user.email || "U")}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>My Account</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/dashboard")}>
                      <User className="mr-2 h-4 w-4" />
                      Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/create-listing")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Listing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/messages")}>
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Messages
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/kyc")}>
                      <Shield className="mr-2 h-4 w-4" />
                      KYC Verification
                    </DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => navigate("/admin")}>
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Panel
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleSignOut}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" className="hidden sm:flex" onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
                
                <Button variant="accent" size="sm" className="sm:h-10 sm:px-4" onClick={() => navigate("/auth")}>
                  Get Started
                </Button>
              </>
            )}

            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[88vw] max-w-[360px] sm:max-w-[400px] p-0 flex flex-col"
              >
                <SheetHeader className="px-5 pt-5 pb-3 border-b">
                  <SheetTitle className="flex items-center gap-2 text-left">
                    <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center">
                      <span className="text-xl font-bold text-primary-foreground">OX</span>
                    </div>
                    Menu
                  </SheetTitle>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 flex flex-col gap-1 pb-[env(safe-area-inset-bottom)]">
                  <Link 
                    to="/" 
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname === "/" ? "font-bold" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Home className="w-5 h-5" />
                    <span className="font-medium">Home</span>
                  </Link>
                  
                  <Link 
                    to="/listings" 
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname === "/listings" ? "font-bold" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Grid className="w-5 h-5" />
                    <span className="font-medium">Browse Listings</span>
                  </Link>

                  <Link
                    to="/logistics"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname.startsWith("/logistics") ? "font-bold" : ""}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Truck className="w-5 h-5" />
                    <span className="font-medium">OX Logistics</span>
                  </Link>

                  {user ? (
                    <>
                      <Separator className="my-2" />
                      
                      <Link 
                        to="/dashboard" 
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname === "/dashboard" ? "font-bold" : ""}`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <User className="w-5 h-5" />
                        <span className="font-medium">Dashboard</span>
                      </Link>
                      
                      <Link 
                        to="/create-listing" 
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname === "/create-listing" ? "font-bold" : ""}`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Plus className="w-5 h-5" />
                        <span className="font-medium">Create Listing</span>
                      </Link>
                      
                      <Link 
                        to="/messages" 
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname === "/messages" ? "font-bold" : ""}`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <MessageSquare className="w-5 h-5" />
                        <span className="font-medium">Messages</span>
                      </Link>
                      
                      <Link 
                        to="/kyc" 
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname === "/kyc" ? "font-bold" : ""}`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <Shield className="w-5 h-5" />
                        <span className="font-medium">KYC Verification</span>
                      </Link>

                      {isAdmin && (
                        <Link
                          to="/admin"
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted transition-colors ${location.pathname.startsWith("/admin") ? "font-bold" : ""}`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <Shield className="w-5 h-5" />
                          <span className="font-medium">Admin Panel</span>
                        </Link>
                      )}

                      <Separator className="my-2" />
                      
                      
                      <Button 
                        variant="outline" 
                        className="justify-start gap-3"
                        onClick={() => {
                          handleSignOut();
                          setMobileMenuOpen(false);
                        }}
                      >
                        <LogOut className="w-5 h-5" />
                        Sign Out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Separator className="my-2" />
                      
                      <Button 
                        onClick={() => {
                          navigate("/auth");
                          setMobileMenuOpen(false);
                        }}
                        className="w-full"
                      >
                        Get Started
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
