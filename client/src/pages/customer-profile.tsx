import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Coffee, LogOut, ShoppingBag, Gift, Loader2, User, Mail, Phone, Pencil, Save, X, Trash2 } from "lucide-react";
import { useCustomer } from "@/contexts/CustomerContext";
import { customerStorage, type CustomerProfile } from "@/lib/customer-storage";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import SarIcon from "@/components/sar-icon";

export default function CustomerProfilePage() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { customer, logout } = useCustomer();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const { data: serverOrders = [], isLoading: isLoadingOrders } = useQuery<any[]>({
    queryKey: ["/api/orders/customer", customer?.phone],
    queryFn: async () => {
      const res = await fetch(`/api/orders/customer/${customer?.phone}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!customer?.phone,
  });

  useEffect(() => {
    if (!customer) {
      setLocation("/auth");
      return;
    }
    const stored = customerStorage.getProfile();
    if (stored) setProfile(stored);
    else setProfile({ id: "", createdAt: new Date().toISOString(), name: customer.name || "", phone: customer.phone || "", email: customer.email || "", stamps: 0, freeDrinks: 0 } as CustomerProfile);
  }, [customer, setLocation]);

  const handleLogout = () => {
    logout();
    toast({ title: t("profile.logged_out"), description: t("profile.see_you_soon") });
    setLocation("/auth");
  };

  const handleClearCache = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie.split(";").forEach((c) => {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) await reg.unregister();
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      toast({ title: "تم المسح ✓", description: "تم مسح الكوكيز والكاش بنجاح، سيتم تحديث الصفحة" });
      setTimeout(() => window.location.replace("/menu"), 1500);
    } catch {
      toast({ variant: "destructive", title: "خطأ", description: "فشل مسح البيانات، حاول مرة أخرى" });
    }
  };

  const startEditing = () => {
    setEditName(customer?.name || "");
    setEditEmail(customer?.email || "");
    setEditPhone(customer?.phone || "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName(""); setEditEmail(""); setEditPhone("");
  };

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { name: string; email: string }) => {
      const customerId = customer?.id;
      if (!customerId) throw new Error("No customer ID");
      return await apiRequest("PATCH", `/api/customers/${customerId}`, data);
    },
    onSuccess: () => {
      toast({ title: t("profile.saved"), description: t("profile.profile_updated_success") });
      setIsEditing(false);
      if (profile) {
        setProfile({ ...profile, name: editName });
        customerStorage.updateProfile({ name: editName });
      }
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: t("profile.error"), description: error.message || t("profile.update_error") });
    }
  });

  const handleSaveProfile = () => {
    if (!editName.trim()) {
      toast({ variant: "destructive", title: t("profile.error"), description: t("profile.name_required") });
      return;
    }
    updateProfileMutation.mutate({ name: editName, email: editEmail });
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Combine local and server orders, dedup by orderNumber
  const localOrders = customerStorage.getOrders();
  const allOrders = [...serverOrders];
  localOrders.forEach(local => {
    if (!allOrders.find(s => s.orderNumber === local.orderNumber)) allOrders.push(local);
  });
  allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 p-4 shadow-lg">
        <div className="container mx-auto flex justify-between items-center gap-2">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Coffee className="w-6 h-6" />
            مكان الشيف البخاري
          </h1>
          <Button onClick={handleLogout} variant="ghost" className="text-white hover:text-white hover:bg-white/20" data-testid="button-logout">
            <LogOut className="ml-2 w-4 h-4" />
            {t("profile.logout")}
          </Button>
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-2xl space-y-6">

        {/* ── Profile info card ── */}
        <Card className="bg-white border-border shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                {isEditing ? t("profile.edit_info") : t("profile.welcome", { name: profile.name })}
              </CardTitle>
              {!isEditing && (
                <Button variant="ghost" size="sm" onClick={startEditing} className="text-primary hover:text-primary hover:bg-primary/10" data-testid="button-edit-profile">
                  <Pencil className="w-4 h-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-name">{t("profile.name")}</Label>
                  <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} className="mt-1" data-testid="input-name" />
                </div>
                <div>
                  <Label htmlFor="edit-email">{t("profile.email")}</Label>
                  <Input id="edit-email" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="mt-1" data-testid="input-email" />
                </div>
                <div>
                  <Label htmlFor="edit-phone">{t("profile.phone")}</Label>
                  <Input id="edit-phone" value={editPhone} disabled className="mt-1 bg-muted" data-testid="input-phone" />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleSaveProfile} disabled={updateProfileMutation.isPending} className="flex-1" data-testid="button-save">
                    {updateProfileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : <Save className="w-4 h-4 ml-2" />}
                    {t("profile.save")}
                  </Button>
                  <Button variant="outline" onClick={cancelEditing} data-testid="button-cancel">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.name && (
                  <div className="flex items-center gap-3 text-sm">
                    <User className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground" data-testid="text-name">{profile.name}</span>
                  </div>
                )}
                {(customer?.phone || profile.phone) && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground font-mono" data-testid="text-phone">{customer?.phone || profile.phone}</span>
                  </div>
                )}
                {(customer?.email || profile.email) && (
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-foreground" data-testid="text-email">{customer?.email || profile.email}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Orders ── */}
        <div>
          <h2 className="text-lg font-black text-foreground flex items-center gap-2 mb-3">
            <ShoppingBag className="w-5 h-5 text-primary" />
            {t("profile.my_orders")}
          </h2>

          {isLoadingOrders ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : allOrders.length === 0 ? (
            <Card className="bg-white border-border shadow-sm">
              <CardContent className="p-8 text-center text-muted-foreground">
                <ShoppingBag className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>{t("profile.no_previous_orders")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {allOrders.map((order) => (
                <Card key={order.id || order.orderNumber} className="bg-white border-border shadow-sm" data-testid={`order-${order.orderNumber}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    <div>
                      <CardTitle className="text-base text-foreground">
                        {t("orders.order_number")} {order.orderNumber}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground text-xs">
                        {order.createdAt ? (() => {
                          try {
                            return new Date(order.createdAt).toLocaleDateString('ar-SA', {
                              year: 'numeric', month: 'long', day: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            });
                          } catch { return '—'; }
                        })() : '—'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className="bg-primary text-white">
                        {order.totalAmount} <SarIcon />
                      </Badge>
                      {order.status && (
                        <Badge variant="outline" className="text-[10px] py-0 h-5 border-border text-muted-foreground">
                          {order.status === 'completed' ? t("profile.status_completed") :
                           order.status === 'pending' ? t("profile.status_pending") :
                           order.status === 'preparing' ? t("profile.status_preparing") : order.status}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {(Array.isArray(order.items) ? order.items : []).map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between text-sm text-foreground">
                          <span>{item.nameAr || item.coffeeItem?.nameAr || t("profile.product")} × {item.quantity}</span>
                          <span className="text-muted-foreground">{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)} <SarIcon /></span>
                        </div>
                      ))}
                      {order.usedFreeDrink && (
                        <Badge variant="outline" className="border-green-500 text-green-600 mt-2">
                          <Gift className="ml-1 w-3 h-3" />
                          {t("profile.used_free_drink")}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <Button onClick={() => setLocation("/menu")} variant="outline" className="w-full border-primary text-primary hover:bg-primary/10" data-testid="button-back-menu">
          {t("profile.back_to_menu")}
        </Button>

        <Button
          onClick={handleClearCache}
          variant="ghost"
          className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-sm mt-1"
          data-testid="button-clear-cache"
        >
          <Trash2 className="w-3.5 h-3.5 ml-2" />
          مسح الكوكيز والكاش
        </Button>
      </div>
    </div>
  );
}
