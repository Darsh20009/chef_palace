import { useQuery, useMutation } from "@tanstack/react-query";
import { useTranslate } from "@/lib/useTranslate";
import SarIcon from "@/components/sar-icon";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Package, Truck, Globe, Settings2, Link2, ArrowLeft, Activity,
  RefreshCw, Warehouse, Zap, Users, ShoppingBag, FolderOpen,
  FileText, Wallet, BarChart3, CheckCircle2, AlertCircle, User, Mail, Phone
} from "lucide-react";
import { useLocation } from "wouter";

export default function ExternalIntegrationsPage() {
  const tc = useTranslate();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [apiKey, setApiKey] = useState("");

  const { data: integrations = [] } = useQuery<any[]>({
    queryKey: ["/api/integrations/delivery"],
  });

  const { data: mockStatus } = useQuery<Record<string, any>>({
    queryKey: ["/api/integrations/delivery/mock-status"],
    refetchInterval: 30000,
  });

  const mutation = useMutation({
    mutationFn: async (newIntegration: any) => {
      const res = await apiRequest("POST", "/api/integrations/delivery", newIntegration);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations/delivery"] });
      toast({ title: tc("تم التفعيل بنجاح", "Activated Successfully"), className: "bg-green-600 text-white" });
    },
  });

  const providers = [
    { id: 'hungerstation', nameAr: 'هنقرستيشن', nameEn: 'HungerStation' },
    { id: 'jahez', nameAr: 'جاهز', nameEn: 'Jahez' },
    { id: 'toyou', nameAr: 'تويو', nameEn: 'ToYou' }
  ];

  // مكان الشيف — الإدارة queries
  const { data: qsMe, isLoading: qsMeLoading, refetch: refetchMe } = useQuery<any>({
    queryKey: ["/api/qirox-studio/me"],
    staleTime: 60000,
  });
  const { data: qsStats, isLoading: qsStatsLoading, refetch: refetchStats } = useQuery<any>({
    queryKey: ["/api/qirox-studio/stats"],
    staleTime: 30000,
  });
  const { data: qsOrders, isLoading: qsOrdersLoading, refetch: refetchOrders } = useQuery<any>({
    queryKey: ["/api/qirox-studio/orders"],
    staleTime: 30000,
  });
  const { data: qsProjects, isLoading: qsProjectsLoading, refetch: refetchProjects } = useQuery<any>({
    queryKey: ["/api/qirox-studio/projects"],
    staleTime: 30000,
  });
  const { data: qsInvoices, isLoading: qsInvoicesLoading, refetch: refetchInvoices } = useQuery<any>({
    queryKey: ["/api/qirox-studio/invoices"],
    staleTime: 30000,
  });
  const { data: qsWallet, isLoading: qsWalletLoading, refetch: refetchWallet } = useQuery<any>({
    queryKey: ["/api/qirox-studio/wallet"],
    staleTime: 30000,
  });
  const { data: qsCustomers, isLoading: qsCustomersLoading, refetch: refetchCustomers } = useQuery<any>({
    queryKey: ["/api/qirox-studio/customers"],
    staleTime: 30000,
  });

  const isQSConnected = !!qsMe?.id && !qsMe?.error;

  const refetchAll = () => {
    refetchMe(); refetchStats(); refetchOrders();
    refetchProjects(); refetchInvoices(); refetchWallet(); refetchCustomers();
  };

  return (
    <div className="p-6 space-y-8 bg-background min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setLocation("/manager")}
          className="hover:bg-primary/10"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-primary">{tc("التكاملات الخارجية", "External Integrations")}</h1>
          <p className="text-muted-foreground">{tc("ربط النظام بالخدمات الخارجية وقنوات التوصيل", "Connect the system to external services and delivery channels")}</p>
        </div>
        <Globe className="h-10 w-10 text-primary mr-auto" />
      </div>

      {/* ─── مكان الشيف — الإدارة API Section ─── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white shadow">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">مكان الشيف — الإدارة API</h2>
              <p className="text-sm text-muted-foreground">{tc("مركز إدارة حساب مكان الشيف — الإدارة المتكامل", "Integrated مكان الشيف — الإدارة account management hub")}</p>
            </div>
            {isQSConnected ? (
              <Badge className="bg-green-500/10 text-green-600 border-green-500/30 flex gap-1 items-center">
                <CheckCircle2 className="w-3 h-3" /> {tc("متصل", "Connected")}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-yellow-600 border-yellow-500/30 flex gap-1 items-center">
                <AlertCircle className="w-3 h-3" /> {tc("يتم الاتصال...", "Connecting...")}
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={refetchAll} className="gap-2">
            <RefreshCw className="w-4 h-4" /> {tc("تحديث", "Refresh")}
          </Button>
        </div>

        {/* Account Info Card */}
        {isQSConnected && (
          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  {qsMe?.fullName?.[0] || qsMe?.username?.[0] || "Q"}
                </div>
                <div className="flex-1 space-y-1">
                  <p className="font-bold text-foreground text-lg">{qsMe?.fullName || qsMe?.username}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="w-4 h-4" />
                    <span>{qsMe?.email}</span>
                  </div>
                  {qsMe?.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span dir="ltr">{qsMe?.phone}</span>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {(qsMe?.scopes || []).map((scope: string) => (
                      <Badge key={scope} variant="secondary" className="text-xs">{scope}</Badge>
                    ))}
                  </div>
                </div>
                <div className="text-left text-xs text-muted-foreground">
                  <p>{tc("عضو منذ", "Member since")}</p>
                  <p className="font-medium">{qsMe?.createdAt ? new Date(qsMe.createdAt).toLocaleDateString("ar-SA") : "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-blue-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tc("إجمالي الطلبات", "Total Orders")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="qs-stat-orders">
                  {qsStatsLoading ? "..." : qsStats?.orders?.total ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tc("المشاريع النشطة", "Active Projects")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="qs-stat-projects">
                  {qsStatsLoading ? "..." : qsStats?.projects?.active ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tc("الفواتير", "Invoices")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="qs-stat-invoices">
                  {qsStatsLoading ? "..." : qsStats?.invoices?.total ?? 0}
                </p>
                <p className="text-xs text-emerald-600">
                  {tc("مسددة", "Paid")}: {qsStats?.invoices?.paid ?? 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-violet-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10 text-violet-600">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{tc("رصيد المحفظة", "Wallet Balance")}</p>
                <p className="text-2xl font-bold text-foreground" data-testid="qs-stat-wallet">
                  {qsWalletLoading ? "..." : <>{qsWallet?.balance ?? 0} <SarIcon size={14} /></>}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue stat */}
        {qsStats?.invoices?.totalRevenue !== undefined && (
          <Card className="border-green-500/20 bg-green-50/50 dark:bg-green-950/10">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10 text-green-600">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{tc("إجمالي الإيرادات المُفوترة", "Total Invoiced Revenue")}</p>
                  <p className="text-3xl font-bold text-green-700 dark:text-green-400" data-testid="qs-stat-revenue">
                    {qsStats?.invoices?.totalRevenue?.toLocaleString("ar-SA") ?? 0} <SarIcon size={14} />
                  </p>
                </div>
              </div>
              <div className="text-sm text-muted-foreground text-left space-y-0.5">
                <p>{tc("مسددة", "Paid")}: <span className="font-semibold text-green-600">{qsStats?.invoices?.paid ?? 0}</span></p>
                <p>{tc("معلقة", "Pending")}: <span className="font-semibold text-yellow-600">{qsStats?.invoices?.pending ?? 0}</span></p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Tables Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Orders */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBag className="w-4 h-4 text-blue-500" /> {tc("آخر الطلبات", "Latest Orders")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qsOrdersLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded" />)}
                </div>
              ) : (qsOrders?.data?.length ?? 0) === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <ShoppingBag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{tc("لا توجد طلبات بعد", "No orders yet")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {qsOrders.data.slice(0, 5).map((order: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                      <span className="font-medium">#{order.id || i+1}</span>
                      <span className="text-muted-foreground">{order.status || "—"}</span>
                      <span className="font-semibold">{order.total ?? "—"} <SarIcon size={11} /></span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderOpen className="w-4 h-4 text-emerald-500" /> {tc("المشاريع", "Projects")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qsProjectsLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded" />)}
                </div>
              ) : (qsProjects?.data?.length ?? 0) === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{tc("لا توجد مشاريع بعد", "No projects yet")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {qsProjects.data.slice(0, 5).map((proj: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                      <span className="font-medium">{proj.name || `مشروع ${i+1}`}</span>
                      <Badge variant="outline" className="text-xs">{proj.status || "نشط"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customers */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="w-4 h-4 text-violet-500" /> {tc("العملاء", "Customers")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {qsCustomersLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1,2,3].map(i => <div key={i} className="h-8 bg-muted rounded" />)}
                </div>
              ) : (qsCustomers?.data?.length ?? 0) === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{tc("لا يوجد عملاء بعد", "No customers yet")}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {qsCustomers.data.slice(0, 5).map((cust: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                      <div className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-700 flex items-center justify-center text-xs font-bold">
                        {(cust.name || cust.fullName || "?")[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{cust.name || cust.fullName || `عميل ${i+1}`}</p>
                        {cust.email && <p className="text-xs text-muted-foreground truncate">{cust.email}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invoices */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="w-4 h-4 text-amber-500" /> {tc("آخر الفواتير", "Latest Invoices")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {qsInvoicesLoading ? (
              <div className="space-y-2 animate-pulse">
                {[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded" />)}
              </div>
            ) : (qsInvoices?.data?.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">{tc("لا توجد فواتير بعد", "No invoices yet")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {qsInvoices.data.slice(0, 8).map((inv: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-sm">
                    <span className="font-medium">#{inv.id || inv.number || i+1}</span>
                    <span className="text-muted-foreground">{inv.clientName || inv.customer || "—"}</span>
                    <span className="font-bold">{inv.amount ?? inv.total ?? "—"} <SarIcon size={11} /></span>
                    <Badge
                      className={`text-xs ${inv.status === 'paid' ? 'bg-green-500/10 text-green-600' : 'bg-yellow-500/10 text-yellow-600'}`}
                    >
                      {inv.status === 'paid' ? tc("مسددة", "Paid") : tc("معلقة", "Pending")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Transactions */}
        {(qsWallet?.transactions?.length ?? 0) > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="w-4 h-4 text-violet-500" /> {tc("حركات المحفظة", "Wallet Transactions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {qsWallet.transactions.slice(0, 5).map((tx: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 text-sm">
                    <span className="text-muted-foreground">{tx.description || tx.type || `معاملة ${i+1}`}</span>
                    <span className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount} <SarIcon size={11} />
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Separator />

      {/* ─── Delivery Integrations Section ─── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{tc("تطبيقات التوصيل", "Delivery Apps")}</h2>
            <p className="text-sm text-muted-foreground">{tc("قم بربط متجرك مع تطبيقات التوصيل العالمية لزيادة مبيعاتك", "Connect your store with delivery apps to increase sales")}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {providers.map((provider) => {
            const isEnabled = integrations.find((i: any) => i.provider === provider.id && i.isActive);
            const status = mockStatus?.[provider.id];

            return (
              <Card key={provider.id} className={`border-2 transition-all ${isEnabled ? 'border-green-500/50 shadow-lg shadow-green-500/10' : 'hover:border-primary'}`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xl font-bold">{provider.nameAr}</CardTitle>
                  <div className="flex items-center gap-2">
                    {isEnabled && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs">
                        <Activity className="w-3 h-3 animate-pulse" />
                        {tc("متصل", "Connected")}
                      </div>
                    )}
                    <Truck className="h-6 w-6 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="mb-4">
                    {tc(`ربط الطلبات آلياً مع ${provider.nameAr} وتحديث حالة المخزون.`, `Auto-sync orders with ${provider.nameEn} and update inventory status.`)}
                  </CardDescription>

                  {isEnabled && status && (
                    <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded bg-muted">
                        <span className="text-muted-foreground block">{tc("طلبات اليوم", "Today's Orders")}</span>
                        <span className="font-bold">{status.ordersToday || 0}</span>
                      </div>
                      <div className="p-2 rounded bg-muted">
                        <span className="text-muted-foreground block">{tc("وقت الاستجابة", "Latency")}</span>
                        <span className="font-bold">{status.latency || '...'}</span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`${provider.id}-active`}>{tc("حالة الربط", "Connection Status")}</Label>
                      <Switch id={`${provider.id}-active`} checked={!!isEnabled} />
                    </div>
                    {!isEnabled && (
                      <div className="space-y-2">
                        <Label>{tc(`مفتاح API الخاص بـ ${provider.nameAr}`, `${provider.nameEn} API Key`)}</Label>
                        <Input
                          type="password"
                          placeholder={tc("أدخل المفتاح هنا...", "Enter key here...")}
                          onChange={(e) => setApiKey(e.target.value)}
                          data-testid={`input-apikey-${provider.id}`}
                        />
                        <Button
                          className="w-full"
                          onClick={() => mutation.mutate({ provider: provider.id, apiKey, isActive: true })}
                          data-testid={`button-activate-${provider.id}`}
                        >
                          {tc("تفعيل الربط", "Activate")} <Link2 className="mr-2 h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {isEnabled && (
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1">
                          {tc("إعدادات", "Settings")} <Settings2 className="mr-2 h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ─── Warehouse Section ─── */}
      <Card className="bg-muted/50 border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Package className="ml-2 h-6 w-6 text-primary" /> {tc("مستودعات الإمداد", "Supply Warehouses")}
          </CardTitle>
          <CardDescription>{tc("هذه الميزة تمكنك من إدارة المخزون المركزي وتوزيعه على الفروع", "This feature enables managing central inventory and distributing it to branches")}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-between items-center">
          <p className="text-sm text-muted-foreground">{tc("تم تفعيل واجهة المستودعات المركزية لتمكين التحويل بين المخازن.", "Central warehouse interface activated to enable inter-warehouse transfers.")}</p>
          <Button onClick={() => setLocation("/manager/warehouse")} data-testid="button-warehouse">
            {tc("إدارة المستودعات", "Manage Warehouses")} <Warehouse className="mr-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
