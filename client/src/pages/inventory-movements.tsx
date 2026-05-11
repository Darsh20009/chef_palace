import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { History, Search, ArrowUp, ArrowDown, ArrowRightLeft, Loader2, RefreshCw, Trash2, ShoppingCart, Activity, TrendingDown, Package } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { useTranslate } from "@/lib/useTranslate";

interface StockMovement {
  id: string;
  branchId: string;
  rawItemId: string;
  movementType: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  rawItem?: { nameAr: string; code: string; unit: string; costPerUnit?: number; };
  branch?: { nameAr: string; };
}

interface Branch {
  id?: string;
  nameAr: string;
}

function formatQty(qty: number | undefined | null, unit: string): string {
  if (qty == null || isNaN(qty)) return "-";
  const n = Number(qty);
  if (unit === "kg") {
    if (n < 1) return `${(n * 1000).toFixed(0)} جم`;
    return `${n.toFixed(3)} كجم (${(n * 1000).toFixed(0)} جم)`;
  }
  if (unit === "liter" || unit === "l") {
    if (n < 1) return `${(n * 1000).toFixed(0)} مل`;
    return `${n.toFixed(3)} لتر (${(n * 1000).toFixed(0)} مل)`;
  }
  return n % 1 === 0 ? `${n}` : `${n.toFixed(3)}`;
}

function unitLabel(unit: string, tc: (a: string, b: string) => string): string {
  const map: Record<string, [string, string]> = {
    kg:    ["كجم", "kg"],
    g:     ["جرام", "g"],
    liter: ["لتر", "L"],
    l:     ["لتر", "L"],
    ml:    ["مل", "ml"],
    piece: ["قطعة", "pcs"],
    box:   ["صندوق", "box"],
    bag:   ["كيس", "bag"],
  };
  const entry = map[unit];
  return entry ? tc(entry[0], entry[1]) : unit;
}

export default function InventoryMovementsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [liveRefresh, setLiveRefresh] = useState(false);
  const tc = useTranslate();

  const movementTypeConfig: Record<string, { labelAr: string; labelEn: string; icon: typeof ArrowUp; color: string; direction: "in" | "out" | "neutral" }> = {
    purchase:     { labelAr: "شراء",         labelEn: "Purchase",     icon: ArrowUp,          color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",   direction: "in"      },
    sale:         { labelAr: "بيع/طلب",      labelEn: "Sale/Order",   icon: ArrowDown,        color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",       direction: "out"     },
    transfer_in:  { labelAr: "تحويل وارد",   labelEn: "Transfer In",  icon: ArrowUp,          color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",   direction: "in"      },
    transfer_out: { labelAr: "تحويل صادر",   labelEn: "Transfer Out", icon: ArrowDown,        color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", direction: "out"   },
    adjustment:   { labelAr: "تعديل",        labelEn: "Adjustment",   icon: ArrowRightLeft,   color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",       direction: "neutral" },
    waste:        { labelAr: "هدر/تالف",     labelEn: "Waste",        icon: Trash2,           color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",           direction: "out"     },
    return:       { labelAr: "إرجاع",        labelEn: "Return",       icon: ArrowUp,          color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", direction: "in"    },
  };

  const { data: movements = [], isLoading, dataUpdatedAt } = useQuery<StockMovement[]>({
    queryKey: ["/api/inventory/movements"],
    refetchInterval: liveRefresh ? 8000 : false,
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  useEffect(() => {
    if (!liveRefresh) return;
    const timer = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/movements"] });
    }, 8000);
    return () => clearInterval(timer);
  }, [liveRefresh]);

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.nameAr || id;

  const filteredMovements = movements.filter((movement) => {
    const matchesSearch =
      (movement.rawItem?.nameAr?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (movement.rawItem?.code?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (movement.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesBranch = branchFilter === "all" || movement.branchId === branchFilter;
    const matchesType = typeFilter === "all" || movement.movementType === typeFilter;
    return matchesSearch && matchesBranch && matchesType;
  });

  const inCount  = movements.filter(m => movementTypeConfig[m.movementType]?.direction === "in").length;
  const outCount = movements.filter(m => movementTypeConfig[m.movementType]?.direction === "out").length;
  const wasteCount = movements.filter(m => m.movementType === 'waste').length;

  const totalInKg = movements
    .filter(m => movementTypeConfig[m.movementType]?.direction === "in")
    .reduce((s, m) => s + (m.rawItem?.unit === 'kg' ? (m.quantity || 0) : 0), 0);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 p-4 lg:p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <History className="h-7 w-7 text-green-600" />
          <div>
            <h1 className="text-xl font-bold">{tc("حركات المخزون", "Inventory Movements")}</h1>
            <p className="text-muted-foreground text-xs">{tc("جرد تفصيلي لجميع حركات المواد الخام", "Detailed ledger of all raw material movements")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={liveRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setLiveRefresh(v => !v)}
            data-testid="button-live-refresh"
          >
            <Activity className={`h-4 w-4 ml-1.5 ${liveRefresh ? "animate-pulse" : ""}`} />
            {liveRefresh ? tc("مباشر ✓", "Live ✓") : tc("تتبع مباشر", "Live Track")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/inventory/movements"] })} data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 ml-1.5" />
            {tc("تحديث", "Refresh")}
          </Button>
        </div>
      </div>

      {liveRefresh && (
        <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
          {tc(`تتبع مباشر نشط — يتحدث كل 8 ثوانٍ | آخر تحديث: ${dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ar-SA') : '-'}`,
            `Live tracking active — updates every 8s | Last: ${dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('en-US') : '-'}`)}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{tc("إجمالي الحركات","Total Movements")}</p>
                <p className="text-2xl font-bold">{movements.length}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tc("حركة مخزون","stock moves")}</p>
              </div>
              <History className="h-8 w-8 text-muted-foreground/40" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{tc("واردة","Incoming")}</p>
                <p className="text-2xl font-bold text-green-600">{inCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tc("شراء وتحويل","purchase & transfer")}</p>
              </div>
              <ArrowUp className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{tc("صادرة","Outgoing")}</p>
                <p className="text-2xl font-bold text-blue-600">{outCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tc("بيع وتحويل","sale & transfer")}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{tc("هدر/تالف","Waste")}</p>
                <p className="text-2xl font-bold text-red-600">{wasteCount}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tc("مواد تالفة","damaged")}</p>
              </div>
              <Trash2 className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={tc("بحث بالمادة أو الملاحظات...", "Search by material or notes...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
                data-testid="input-search-movements"
              />
            </div>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-branch-filter">
                <SelectValue placeholder={tc("الفرع", "Branch")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الفروع", "All Branches")}</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id as string}>{branch.nameAr}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
                <SelectValue placeholder={tc("نوع الحركة", "Movement Type")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("جميع الأنواع", "All Types")}</SelectItem>
                {Object.entries(movementTypeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{tc(cfg.labelAr, cfg.labelEn)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-xs">
              {filteredMovements.length} {tc("نتيجة","results")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right whitespace-nowrap">{tc("التاريخ والوقت","Date & Time")}</TableHead>
                  <TableHead className="text-right">{tc("النوع","Type")}</TableHead>
                  <TableHead className="text-right">{tc("المادة الخام","Material")}</TableHead>
                  <TableHead className="text-right">{tc("الوحدة","Unit")}</TableHead>
                  <TableHead className="text-right">{tc("الفرع","Branch")}</TableHead>
                  <TableHead className="text-right">{tc("الكمية المحركة","Moved Qty")}</TableHead>
                  <TableHead className="text-right">{tc("قبل الحركة","Before")}</TableHead>
                  <TableHead className="text-right">{tc("بعد الحركة","After")}</TableHead>
                  <TableHead className="text-right">{tc("التغيير","Change")}</TableHead>
                  <TableHead className="text-right">{tc("المرجع","Reference")}</TableHead>
                  <TableHead className="text-right">{tc("ملاحظات","Notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      <Package className="h-10 w-10 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">{tc("لا توجد حركات مخزون","No inventory movements found")}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => {
                    const config = movementTypeConfig[movement.movementType] || movementTypeConfig.adjustment;
                    const MovementIcon = config.icon;
                    const unit = movement.rawItem?.unit || "";
                    const diff = (movement.newQuantity ?? 0) - (movement.previousQuantity ?? 0);
                    const isPositive = diff > 0;

                    return (
                      <TableRow key={movement.id} className="hover:bg-muted/30" data-testid={`row-movement-${movement.id}`}>
                        {/* Date */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          <div>{format(new Date(movement.createdAt), "dd/MM/yyyy", { locale: ar })}</div>
                          <div className="text-[11px] opacity-70">{format(new Date(movement.createdAt), "HH:mm:ss")}</div>
                        </TableCell>

                        {/* Type badge */}
                        <TableCell>
                          <Badge className={`${config.color} flex items-center gap-1 w-fit text-xs whitespace-nowrap`}>
                            <MovementIcon className="h-3 w-3" />
                            {tc(config.labelAr, config.labelEn)}
                          </Badge>
                        </TableCell>

                        {/* Material */}
                        <TableCell>
                          <div className="font-semibold text-sm">{movement.rawItem?.nameAr || tc("غير محدد","Unknown")}</div>
                          {movement.rawItem?.code && (
                            <div className="text-[11px] text-muted-foreground font-mono">{movement.rawItem.code}</div>
                          )}
                        </TableCell>

                        {/* Unit */}
                        <TableCell>
                          <span className="text-xs font-medium bg-muted rounded px-1.5 py-0.5">
                            {unitLabel(unit, tc)}
                          </span>
                          {unit === "kg" && <div className="text-[10px] text-muted-foreground mt-0.5">= جرام</div>}
                          {(unit === "liter" || unit === "l") && <div className="text-[10px] text-muted-foreground mt-0.5">= مل</div>}
                        </TableCell>

                        {/* Branch */}
                        <TableCell className="text-sm">
                          {movement.branch?.nameAr || getBranchName(movement.branchId)}
                        </TableCell>

                        {/* Moved Quantity */}
                        <TableCell>
                          <span className={`font-bold text-sm ${config.direction === "in" ? "text-green-600" : config.direction === "out" ? "text-red-600" : "text-foreground"}`}>
                            {config.direction === "in" ? "+" : config.direction === "out" ? "-" : "±"}
                            {formatQty(movement.quantity, unit)}
                          </span>
                        </TableCell>

                        {/* Before */}
                        <TableCell>
                          <div className="text-sm text-muted-foreground">{formatQty(movement.previousQuantity, unit)}</div>
                        </TableCell>

                        {/* After */}
                        <TableCell>
                          <div className={`text-sm font-semibold ${
                            (movement.newQuantity ?? 0) <= 0 ? "text-red-600" :
                            (movement.newQuantity ?? 0) < 0.5 ? "text-orange-600" : "text-foreground"
                          }`}>
                            {formatQty(movement.newQuantity, unit)}
                          </div>
                        </TableCell>

                        {/* Net Change */}
                        <TableCell>
                          <span className={`text-xs font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
                            {isPositive ? "▲" : "▼"} {formatQty(Math.abs(diff), unit)}
                          </span>
                        </TableCell>

                        {/* Reference */}
                        <TableCell className="text-xs text-muted-foreground">
                          {movement.referenceType && (
                            <div className="font-medium">{movement.referenceType}</div>
                          )}
                          {movement.referenceId && (
                            <div className="font-mono opacity-60 max-w-[80px] truncate">{movement.referenceId}</div>
                          )}
                        </TableCell>

                        {/* Notes */}
                        <TableCell className="text-xs text-muted-foreground max-w-[160px]">
                          <span className="line-clamp-2">{movement.notes || "—"}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredMovements.length > 0 && (
            <div className="px-4 py-3 border-t bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
              <span>{filteredMovements.length} {tc("حركة معروضة من","of")} {movements.length} {tc("إجمالاً","total")}</span>
              <span>{tc("الأحدث أولاً","Latest first")}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
