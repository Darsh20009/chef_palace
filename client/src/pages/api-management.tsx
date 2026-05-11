import { useState } from "react";
import { PlanGate } from "@/components/plan-gate";
import { useTranslate, tc } from "@/lib/useTranslate";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Key, Copy, Plus, Trash2, Eye, EyeOff, Code2, Globe, ShieldCheck, Loader2, RefreshCw, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

const PUBLIC_ENDPOINTS = [
  { method: "GET", path: "/api/menu", description: tc("قائمة المنتجات المتاحة", "Available Products List"), auth: "none" },
  { method: "GET", path: "/api/promo-offers", description: tc("العروض الترويجية النشطة", "Active Promo Offers"), auth: "none" },
  { method: "GET", path: "/api/gift-cards/check/:code", description: tc("التحقق من بطاقة هدية", "Check Gift Card"), auth: "none" },
  { method: "POST", path: "/api/orders", description: tc("إنشاء طلب جديد", "Create New Order"), auth: "none" },
  { method: "GET", path: "/api/orders/:id", description: tc("تفاصيل طلب", "Order Details"), auth: "none" },
  { method: "GET", path: "/api/discount-codes", description: tc("رموز الخصم المتاحة", "Available Discount Codes"), auth: "none" },
  { method: "POST", path: "/api/customers/register", description: tc("تسجيل عميل جديد", "Register New Customer"), auth: "none" },
  { method: "POST", path: "/api/customers/login", description: tc("تسجيل دخول العميل", "Customer Login"), auth: "none" },
  { method: "GET", path: "/api/loyalty/cards/phone", description: tc("بطاقة ولاء العميل", "Customer Loyalty Card"), auth: "customer" },
  { method: "POST", path: "/api/cart", description: tc("إضافة للسلة", "Add to Cart"), auth: "session" },
  { method: "GET", path: "/api/cart", description: tc("محتوى السلة", "Cart Contents"), auth: "session" },
];

const MANAGER_ENDPOINTS = [
  { method: "GET", path: "/api/orders", description: tc("كل الطلبات", "All Orders"), auth: "manager" },
  { method: "PUT", path: "/api/orders/:id/status", description: tc("تحديث حالة الطلب", "Update Order Status"), auth: "employee" },
  { method: "GET", path: "/api/admin/promo-offers", description: tc("إدارة العروض", "Manage Offers"), auth: "manager" },
  { method: "POST", path: "/api/promo-offers", description: tc("إنشاء عرض ترويجي", "Create Promo Offer"), auth: "manager" },
  { method: "POST", path: "/api/gift-cards", description: tc("إنشاء بطاقة هدية", "Create Gift Card"), auth: "manager" },
  { method: "GET", path: "/api/gift-cards", description: tc("قائمة بطاقات الهدايا", "Gift Cards List"), auth: "manager" },
  { method: "GET", path: "/api/employees", description: tc("الموظفون", "Employees"), auth: "manager" },
  { method: "GET", path: "/api/loyalty/cards", description: tc("بطاقات الولاء", "Loyalty Cards"), auth: "manager" },
  { method: "GET", path: "/api/discount-codes", description: tc("رموز الخصم", "Discount Codes"), auth: "manager" },
  { method: "POST", path: "/api/discount-codes", description: "إنشاء رمز خصم", auth: "manager" },
];

const methodColors: Record<string, string> = {
  GET: "bg-blue-100 text-blue-700 border-blue-200",
  POST: "bg-primary/10 text-primary border-primary/20",
  PUT: "bg-amber-100 text-amber-700 border-amber-200",
  DELETE: "bg-red-100 text-red-700 border-red-200",
  PATCH: "bg-purple-100 text-purple-700 border-purple-200",
};

const authColors: Record<string, string> = {
  none: "bg-gray-100 text-gray-600",
  session: "bg-blue-50 text-blue-600",
  customer: "bg-primary/10 text-primary",
  employee: "bg-amber-50 text-amber-700",
  manager: "bg-purple-50 text-purple-700",
};

interface ApiKey {
  _id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
  permissions: string[];
}

function generateApiKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const prefix = 'qrx_';
  let result = prefix;
  for (let i = 0; i < 40; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default function ApiManagement() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  // Mock API keys (stored in localStorage for demo — in production use DB)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(() => {
    try {
      const stored = localStorage.getItem("qirox_api_keys");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const saveKeys = (keys: ApiKey[]) => {
    setApiKeys(keys);
    localStorage.setItem("qirox_api_keys", JSON.stringify(keys));
  };

  const createKey = () => {
    if (!newKeyName.trim()) return toast({ variant: "destructive", title: "أدخل اسم المفتاح" });
    const newKey: ApiKey = {
      _id: Date.now().toString(),
      name: newKeyName,
      key: generateApiKey(),
      createdAt: new Date().toISOString(),
      permissions: ["read", "write"],
    };
    saveKeys([...apiKeys, newKey]);
    setRevealedKeys(prev => new Set([...prev, newKey._id]));
    setNewKeyName("");
    setShowCreateKey(false);
    toast({ title: "تم إنشاء المفتاح", description: "احفظ المفتاح الآن — لن يُعرض مجدداً!" });
  };

  const deleteKey = (id: string) => {
    saveKeys(apiKeys.filter(k => k._id !== id));
    toast({ title: "تم الحذف" });
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(id);
      setTimeout(() => setCopiedKey(null), 2000);
      toast({ title: "تم النسخ" });
    });
  };

  const toggleReveal = (id: string) => {
    setRevealedKeys(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const baseUrl = window.location.origin;

  return (
    <PlanGate feature="apiAccess">
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin/dashboard")} data-testid="btn-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-foreground">إدارة API</h1>
            <p className="text-muted-foreground text-sm mt-0.5">مفاتيح الوصول وتوثيق الواجهة البرمجية</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 text-primary border-primary/30 bg-primary/5">
            <Globe className="w-3.5 h-3.5" /> {baseUrl}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(["keys", "docs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            data-testid={`tab-api-${tab}`}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tab === "keys" ? "🔑 مفاتيح API" : "📄 التوثيق"}
          </button>
        ))}
      </div>

      {activeTab === "keys" ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-semibold text-foreground">مفاتيح الوصول</h2>
            <Button onClick={() => setShowCreateKey(true)} data-testid="button-create-api-key">
              <Plus className="w-4 h-4 ml-2" /> مفتاح جديد
            </Button>
          </div>

          {apiKeys.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Key className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground">لا توجد مفاتيح API بعد</p>
                <p className="text-sm text-muted-foreground mt-1">أنشئ مفتاحاً للوصول البرمجي للنظام</p>
                <Button className="mt-4" onClick={() => setShowCreateKey(true)}>إنشاء مفتاح</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {apiKeys.map(key => (
                <Card key={key._id} data-testid={`card-api-key-${key._id}`}>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Key className="w-4 h-4 text-primary" />
                          <span className="font-bold">{key.name}</span>
                          <Badge variant="outline" className="text-xs text-primary border-primary/20 bg-primary/5">نشط</Badge>
                        </div>
                        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                          <code className="text-xs font-mono flex-1 truncate">
                            {revealedKeys.has(key._id) ? key.key : `${key.key.slice(0, 12)}${"•".repeat(20)}`}
                          </code>
                          <button onClick={() => toggleReveal(key._id)} className="text-muted-foreground hover:text-foreground shrink-0" data-testid={`button-reveal-key-${key._id}`}>
                            {revealedKeys.has(key._id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button onClick={() => copyToClipboard(key.key, key._id)} className="text-muted-foreground hover:text-primary shrink-0" data-testid={`button-copy-key-${key._id}`}>
                            {copiedKey === key._id ? <ShieldCheck className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          أُنشئ: {new Date(key.createdAt).toLocaleDateString('ar')}
                          {key.lastUsed && ` · آخر استخدام: ${new Date(key.lastUsed).toLocaleDateString('ar')}`}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => deleteKey(key._id)} data-testid={`button-delete-key-${key._id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Public Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Globe className="w-4 h-4 text-primary" /> واجهات عامة (Public)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PUBLIC_ENDPOINTS.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`api-endpoint-public-${i}`}>
                  <Badge variant="outline" className={`text-xs font-mono w-14 justify-center shrink-0 ${methodColors[ep.method] || ""}`}>{ep.method}</Badge>
                  <code className="text-xs font-mono text-foreground flex-1 truncate">{ep.path}</code>
                  <span className="text-xs text-muted-foreground hidden md:block flex-1">{ep.description}</span>
                  <Badge variant="outline" className={`text-xs shrink-0 ${authColors[ep.auth] || ""}`}>{ep.auth === "none" ? "عام" : ep.auth}</Badge>
                  <button onClick={() => copyToClipboard(`${baseUrl}${ep.path}`, `pub-${i}`)} className="text-muted-foreground hover:text-primary">
                    {copiedKey === `pub-${i}` ? <ShieldCheck className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Manager Endpoints */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="w-4 h-4 text-purple-600" /> واجهات المدير (Authenticated)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {MANAGER_ENDPOINTS.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors" data-testid={`api-endpoint-manager-${i}`}>
                  <Badge variant="outline" className={`text-xs font-mono w-14 justify-center shrink-0 ${methodColors[ep.method] || ""}`}>{ep.method}</Badge>
                  <code className="text-xs font-mono text-foreground flex-1 truncate">{ep.path}</code>
                  <span className="text-xs text-muted-foreground hidden md:block flex-1">{ep.description}</span>
                  <Badge variant="outline" className={`text-xs shrink-0 ${authColors[ep.auth] || ""}`}>{ep.auth}</Badge>
                  <button onClick={() => copyToClipboard(`${baseUrl}${ep.path}`, `mgr-${i}`)} className="text-muted-foreground hover:text-primary">
                    {copiedKey === `mgr-${i}` ? <ShieldCheck className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Code Example */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Code2 className="w-4 h-4 text-primary" /> مثال على الاستخدام
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted rounded-lg p-4 text-xs font-mono overflow-x-auto text-left" dir="ltr">
{`// Fetch menu items
const response = await fetch('${baseUrl}/api/menu');
const menu = await response.json();

// Create an order
const order = await fetch('${baseUrl}/api/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customerName: 'Ahmed',
    items: [{ coffeeItemId: 'item-id', quantity: 1, price: 18 }],
    totalAmount: 18,
    paymentMethod: 'cash',
    channel: 'online'
  })
});`}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Key Dialog */}
      <Dialog open={showCreateKey} onOpenChange={setShowCreateKey}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>إنشاء مفتاح API جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-semibold block mb-1">اسم المفتاح</label>
              <Input
                value={newKeyName}
                onChange={e => setNewKeyName(e.target.value)}
                placeholder="مثال: تطبيق الموبايل"
                onKeyDown={e => e.key === "Enter" && createKey()}
                data-testid="input-new-key-name"
              />
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2 rounded-lg">
              ⚠️ احفظ المفتاح بعد الإنشاء مباشرة — لن يُعرض كاملاً مجدداً
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateKey(false)}>إلغاء</Button>
            <Button onClick={createKey} data-testid="button-confirm-create-key">إنشاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </PlanGate>
  );
}
