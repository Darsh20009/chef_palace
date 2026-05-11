import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Home, ShoppingCart, User, CreditCard, ClipboardList, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/lib/cart-store";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

import { CustomerFooter } from "@/components/customer-footer";

interface CustomerLayoutProps {
  children: ReactNode;
  showNav?: boolean;
  showHeader?: boolean;
  title?: string;
}

export function CustomerLayout({ 
  children, 
  showNav = true, 
  showHeader = false,
  title 
}: CustomerLayoutProps) {
  const [location] = useLocation();
  const { cartItems, showCart } = useCartStore();
  const { t, i18n } = useTranslation();
  const cartItemCount = cartItems.reduce((acc: number, item: { quantity: number }) => acc + item.quantity, 0);

  const navItems = [
    { path: "/menu", icon: Home, label: t("nav.menu") || "القائمة", testId: "nav-menu" },
    { path: "/my-offers", icon: Gift, label: t("nav.my_offers") || "عروضي", testId: "nav-my-offers" },
    { path: "/my-orders", icon: ClipboardList, label: t("nav.my_orders") || "طلباتي", testId: "nav-my-orders" },
    { path: "/my-card", icon: CreditCard, label: t("nav.my_card") || "محفظتي", testId: "nav-my-card" },
    { path: "/profile", icon: User, label: t("nav.profile") || "حسابي", testId: "nav-profile" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-ibm-arabic" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      {showHeader && (
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
          <div className="container flex h-14 items-center justify-between gap-2">
            <h1 className="text-lg font-semibold">{title}</h1>
            <Button 
              variant="ghost" 
              size="icon" 
              className="relative"
              onClick={showCart}
              data-testid="button-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {cartItemCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -left-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>
        </header>
      )}

      <main className="flex-1 pb-20">
        {children}
      </main>

      <CustomerFooter />

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t">
          <div className="container flex h-16 items-center justify-around">
            {navItems.map((item) => {
              const isActive = location === item.path;
              return (
                <Button
                  key={item.path}
                  asChild
                  variant="ghost"
                  className={`flex flex-col gap-1 h-auto py-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
                  data-testid={item.testId}
                >
                  <Link href={item.path}>
                    <item.icon className="h-5 w-5" />
                    <span className="text-xs">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
            <Button
              variant="ghost"
              className="flex flex-col gap-1 h-auto py-2 text-muted-foreground relative"
              onClick={showCart}
              data-testid="nav-cart"
            >
              <ShoppingCart className="h-5 w-5" />
              <span className="text-xs">{t("nav.cart") || "السلة"}</span>
              {cartItemCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -left-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
