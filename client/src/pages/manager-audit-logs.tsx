import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Shield, Search, RefreshCw, Filter, User, Package, ShoppingCart, Trash2, Edit, LogIn, Printer, Tag, AlertTriangle } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

const ACTION_ICONS: Record<string, any> = {
  "order.cancel": Trash2,
  "order.delete": Trash2,
  "order.status_change": ShoppingCart,
  "order.discount": Tag,
  "product.delete": Package,
  "product.update": Edit,
  "employee.login": LogIn,
  "employee.logout": LogIn,
  "table.delete": Trash2,
  "print.receipt": Printer,
  "loyalty.claim": Tag,
  default: AlertTriangle,
};

const ACTION_COLORS: Record<string, string> = {
  "order.cancel": "bg-red-100 text-red-700",
  "order.delete": "bg-red-100 text-red-700",
  "order.status_change": "bg-blue-100 text-blue-700",
  "order.discount": "bg-purple-100 text-purple-700",
  "product.delete": "bg-red-100 text-red-700",
  "product.update": "bg-yellow-100 text-yellow-700",
  "employee.login": "bg-green-100 text-green-700",
  "table.delete": "bg-red-100 text-red-700",
  "print.receipt": "bg-gray-100 text-gray-700",
  "loyalty.claim": "bg-indigo-100 text-indigo-700",
  default: "bg-gray-100 text-gray-700",
};

const ACTOR_TYPE_LABELS: Record<string, { ar: string; en: string }> = {
  employee: { ar: "موظف",   en: "Employee" },
  manager:  { ar: "مدير",   en: "Manager"  },
  admin:    { ar: "أدمن",   en: "Admin"    },
  system:   { ar: "النظام", en: "System"   },
  customer: { ar: "عميل",   en: "Customer" },
};

const ACTION_LABELS: Record<string, { ar: string; en: string }> = {
  "order.cancel":       { ar: "إلغاء طلب",          en: "Cancel Order"          },
  "order.delete":       { ar: "حذف طلب",             en: "Delete Order"          },
  "order.status_change":{ ar: "تغيير حالة طلب",     en: "Change Order Status"   },
  "order.discount":     { ar: "تطبيق خصم",           en: "Apply Discount"        },
  "product.delete":     { ar: "حذف منتج",            en: "Delete Product"        },
  "product.update":     { ar: "تعديل منتج",          en: "Edit Product"          },
  "employee.login":     { ar: "تسجيل دخول",          en: "Login"                 },
  "employee.logout":    { ar: "تسجيل خروج",          en: "Logout"                },
  "table.delete":       { ar: "حذف طاولة",           en: "Delete Table"          },
  "tables.delete_all":  { ar: "حذف كل الطاولات",     en: "Delete All Tables"     },
  "print.receipt":      { ar: "طباعة فاتورة",         en: "Print Receipt"         },
  "loyalty.claim":      { ar: "استبدال نقاط",         en: "Redeem Points"         },
};

export default function ManagerAuditLogsPage() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("all");
  const [filterActor, setFilterActor] = useState("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const params = new URLSearchParams();
  if (filterAction !== "all") params.set("action", filterAction);
  if (filterActor !== "all") params.set("actorType", filterActor);
  if (search) params.set("search", search);
  params.set("limit", String(PAGE_SIZE));
  params.set("offset", String((page - 1) * PAGE_SIZE));

  const { data, isLoading, refetch } = useQuery<{ logs: any[]; total: number }>({
    queryKey: ["/api/audit-logs", filterAction, filterActor, search, page],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white min-h-screen">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/manager/dashboard")} data-testid="btn-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            {tc("سجل التدقيق", "Audit Logs")}
          </h1>
          <p className="text-sm text-gray-500">{tc("كل إجراء يتم تسجيله بالموظف والوقت", "Every action is logged with actor and time")}</p>
        </div>
        <div className="mr-auto flex items-center gap-2">
          <Badge variant="outline" className="text-sm">{tc(`${total} سجل`, `${total} records`)}</Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="btn-refresh">
            <RefreshCw className="w-4 h-4 ml-1" />
            {tc("تحديث", "Refresh")}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border border-gray-200">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder={tc("بحث باسم الموظف أو الكيان...", "Search by actor or entity...")}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="pr-9 text-sm"
                data-testid="input-search"
              />
            </div>
            <Select value={filterAction} onValueChange={v => { setFilterAction(v); setPage(1); }}>
              <SelectTrigger className="w-[180px]" data-testid="select-action">
                <Filter className="w-4 h-4 ml-2" />
                <SelectValue placeholder={tc("نوع الإجراء", "Action type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("كل الإجراءات", "All actions")}</SelectItem>
                <SelectItem value="order.cancel">{tc("إلغاء طلب", "Order cancel")}</SelectItem>
                <SelectItem value="order.delete">{tc("حذف طلب", "Order delete")}</SelectItem>
                <SelectItem value="order.status_change">{tc("تغيير حالة", "Status change")}</SelectItem>
                <SelectItem value="order.discount">{tc("خصم", "Discount")}</SelectItem>
                <SelectItem value="product.delete">{tc("حذف منتج", "Product delete")}</SelectItem>
                <SelectItem value="product.update">{tc("تعديل منتج", "Product update")}</SelectItem>
                <SelectItem value="employee.login">{tc("تسجيل دخول", "Login")}</SelectItem>
                <SelectItem value="table.delete">{tc("حذف طاولة", "Table delete")}</SelectItem>
                <SelectItem value="loyalty.claim">{tc("استبدال نقاط", "Loyalty claim")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterActor} onValueChange={v => { setFilterActor(v); setPage(1); }}>
              <SelectTrigger className="w-[150px]" data-testid="select-actor">
                <User className="w-4 h-4 ml-2" />
                <SelectValue placeholder={tc("المنفذ", "Actor")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("الكل", "All")}</SelectItem>
                <SelectItem value="employee">{tc("موظف", "Employee")}</SelectItem>
                <SelectItem value="manager">{tc("مدير", "Manager")}</SelectItem>
                <SelectItem value="admin">{tc("أدمن", "Admin")}</SelectItem>
                <SelectItem value="system">{tc("النظام", "System")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Log Table */}
      <Card className="border border-gray-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-gray-800">{tc("السجلات الأخيرة", "Recent Logs")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              {tc("جارٍ التحميل...", "Loading...")}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{tc("لا توجد سجلات", "No logs found")}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log: any) => {
                const ActionIcon = ACTION_ICONS[log.action] || ACTION_ICONS.default;
                const actionColor = ACTION_COLORS[log.action] || ACTION_COLORS.default;
                const actionEntry = ACTION_LABELS[log.action];
                const actionLabel = actionEntry ? tc(actionEntry.ar, actionEntry.en) : log.action;
                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors" data-testid={`log-row-${log.id}`}>
                    <div className={`p-2 rounded-lg shrink-0 ${actionColor}`}>
                      <ActionIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-gray-900">{actionLabel}</span>
                        {log.entityLabel && (
                          <Badge variant="outline" className="text-xs h-5 border-gray-300 text-gray-600">
                            {log.entityLabel}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {log.actorName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {log.actorName}
                            {log.actorRole && <span className="text-gray-400">({log.actorRole})</span>}
                          </span>
                        )}
                        {log.branchId && <span>{tc(`فرع: ${log.branchId}`, `Branch: ${log.branchId}`)}</span>}
                        {log.ipAddress && log.ipAddress !== "unknown" && <span className="font-mono">{log.ipAddress}</span>}
                        {log.details && Object.keys(log.details).length > 0 && (
                          <span className="text-gray-400 truncate max-w-[200px]">
                            {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(" • ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 shrink-0 text-left">
                      {formatDate(log.createdAt)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            {tc("السابق", "Prev")}
          </Button>
          <span className="text-sm text-gray-600">{tc(`صفحة ${page} من ${totalPages}`, `Page ${page} of ${totalPages}`)}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            {tc("التالي", "Next")}
          </Button>
        </div>
      )}
    </div>
  );
}
