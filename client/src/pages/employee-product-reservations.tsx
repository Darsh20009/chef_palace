import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Calendar, Clock, Phone, User, Package, CheckCircle2, XCircle,
  Clock3, Search, RefreshCw, ChevronDown, ChevronUp, Filter,
  ShoppingBag, CreditCard, AlertCircle, Loader2
} from "lucide-react";

type ResStatus = 'pending_payment' | 'pending_confirmation' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';

const STATUS_CONFIG: Record<ResStatus, { label: string; color: string; icon: any }> = {
  pending_payment:      { label: 'بانتظار الدفع',         color: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300', icon: CreditCard },
  pending_confirmation: { label: 'بانتظار التأكيد',       color: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock3 },
  confirmed:            { label: 'مؤكد',                  color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle2 },
  rejected:             { label: 'مرفوض',                 color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300', icon: XCircle },
  cancelled:            { label: 'ملغى',                  color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400', icon: XCircle },
  completed:            { label: 'مكتمل',                 color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300', icon: CheckCircle2 },
};

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
}

function ReservationCard({ order, onStatusChange }: { order: any; onStatusChange: (id: string, status: ResStatus) => void }) {
  const [expanded, setExpanded] = useState(false);
  const resStatus: ResStatus = order.productReservationStatus || 'pending_payment';
  const statusCfg = STATUS_CONFIG[resStatus];
  const StatusIcon = statusCfg.icon;

  const nextActions: { status: ResStatus; label: string; variant: 'default' | 'destructive' | 'outline' }[] = (() => {
    switch (resStatus) {
      case 'pending_payment':
        return [
          { status: 'pending_confirmation', label: 'تأكيد الدفع →', variant: 'default' },
          { status: 'cancelled', label: 'إلغاء', variant: 'destructive' },
        ];
      case 'pending_confirmation':
        return [
          { status: 'confirmed', label: '✓ تأكيد الحجز', variant: 'default' },
          { status: 'rejected', label: '✗ رفض', variant: 'destructive' },
        ];
      case 'confirmed':
        return [
          { status: 'completed', label: 'إكمال', variant: 'default' },
          { status: 'cancelled', label: 'إلغاء', variant: 'destructive' },
        ];
      default:
        return [];
    }
  })();

  return (
    <Card className="overflow-hidden border-0 shadow-sm" data-testid={`card-product-reservation-${order.id}`}>
      <div className={`h-1 ${resStatus === 'confirmed' ? 'bg-green-500' : resStatus === 'rejected' || resStatus === 'cancelled' ? 'bg-red-400' : resStatus === 'completed' ? 'bg-blue-500' : 'bg-amber-400'}`} />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-bold text-base">#{order.orderNumber}</p>
            <p className="text-sm text-muted-foreground">{order.customerName || '—'}</p>
          </div>
          <Badge className={`${statusCfg.color} border text-xs font-bold gap-1 px-2 py-1`}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          {order.productReservationDate && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{formatDate(order.productReservationDate)}</span>
            </div>
          )}
          {order.productReservationFromTime && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{order.productReservationFromTime} — {order.productReservationToTime}</span>
            </div>
          )}
          {order.customerPhone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <a href={`tel:${order.customerPhone}`} className="hover:text-foreground">{order.customerPhone}</a>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-semibold text-foreground">{(order.totalAmount || 0).toFixed(2)} ر.س</span>
          </div>
        </div>

        {/* Items accordion */}
        <button
          className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors py-1 border-t border-border/50"
          onClick={() => setExpanded(v => !v)}
        >
          <span>المنتجات ({Array.isArray(order.items) ? order.items.length : 0})</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expanded && Array.isArray(order.items) && (
          <div className="space-y-1.5 pt-1">
            {order.items.map((item: any, idx: number) => {
              const pkg = item.customization?.selectedReservationPackage;
              return (
                <div key={idx} className="flex items-start gap-2 bg-muted/40 rounded-lg p-2">
                  <Package className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{item.nameAr || item.coffeeItem?.nameAr || 'منتج'} × {item.quantity}</p>
                    {pkg && <p className="text-xs text-muted-foreground">الباقة: {pkg.packageName}{pkg.maxGuests ? ` · حتى ${pkg.maxGuests} أشخاص` : ''}</p>}
                  </div>
                  <span className="text-xs font-bold text-amber-600">{((item.price || 0) * (item.quantity || 1)).toFixed(2)} ر.س</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Action buttons */}
        {nextActions.length > 0 && (
          <div className="flex gap-2 pt-1">
            {nextActions.map(action => (
              <Button
                key={action.status}
                size="sm"
                variant={action.variant}
                className="flex-1 text-xs h-8"
                onClick={() => onStatusChange(order.id, action.status)}
                data-testid={`button-reservation-${action.status}-${order.id}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EmployeeProductReservations() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: reservations = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/product-reservations'],
    refetchInterval: 30000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ResStatus }) => {
      const res = await apiRequest('PATCH', `/api/product-reservations/${id}/status`, { productReservationStatus: status });
      if (!res.ok) throw new Error('فشل تحديث الحالة');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/product-reservations'] });
      toast({ title: 'تم تحديث حالة الحجز' });
    },
    onError: (err: any) => toast({ title: 'خطأ', description: err.message, variant: 'destructive' }),
  });

  const filtered = reservations.filter(r => {
    const matchStatus = statusFilter === 'all' || r.productReservationStatus === statusFilter;
    const term = search.toLowerCase();
    const matchSearch = !term
      || (r.orderNumber || '').toString().includes(term)
      || (r.customerName || '').toLowerCase().includes(term)
      || (r.customerPhone || '').includes(term);
    return matchStatus && matchSearch;
  });

  const counts = Object.keys(STATUS_CONFIG).reduce((acc, k) => {
    acc[k] = reservations.filter(r => r.productReservationStatus === k).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-4 py-3 space-y-3 max-w-2xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-black">🗓️ حجوزات المنتجات</h1>
              <p className="text-xs text-muted-foreground">{reservations.length} حجز إجمالي</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-refresh-reservations">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم الطلب أو الاسم أو الجوال..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pr-9 h-9 text-sm"
              data-testid="input-search-reservations"
            />
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setStatusFilter('all')}
              className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${statusFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
              data-testid="filter-all"
            >
              الكل ({reservations.length})
            </button>
            {(Object.entries(STATUS_CONFIG) as [ResStatus, typeof STATUS_CONFIG[ResStatus]][]).map(([k, cfg]) => (
              <button
                key={k}
                onClick={() => setStatusFilter(k)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${statusFilter === k ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground hover:text-foreground'}`}
                data-testid={`filter-${k}`}
              >
                {cfg.label} {counts[k] > 0 ? `(${counts[k]})` : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">{search || statusFilter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد حجوزات منتجات بعد'}</p>
            <p className="text-xs mt-1">ستظهر الحجوزات هنا عند إنشائها من العملاء</p>
          </div>
        ) : (
          filtered.map(order => (
            <ReservationCard
              key={order.id}
              order={order}
              onStatusChange={(id, status) => updateStatusMutation.mutate({ id, status })}
            />
          ))
        )}
      </div>
    </div>
  );
}
