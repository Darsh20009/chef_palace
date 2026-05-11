import { useState } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Warehouse, 
  TrendingUp, 
  TrendingDown, 
  Package, 
  AlertTriangle,
  BarChart3,
  Truck,
  Shield
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface BranchStockSummary {
  branchId: string;
  branchName: string;
  totalItems: number;
  lowStockItems: number;
  totalValue: number;
  recentTransfers: number;
}

interface StockOrganizationStats {
  totalBranches: number;
  totalSKUs: number;
  totalInventoryValue: number;
  lowStockItems: number;
  pendingTransfers: number;
  branches: BranchStockSummary[];
}

export default function StockOrganizationDashboard() {
  const tc = useTranslate();
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  const { data: stats, isLoading } = useQuery<StockOrganizationStats>({
    queryKey: ["/api/inventory/organization-stats"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">{tc("جاري التحميل...", "Loading...")}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{tc("تنظيم المخزون عبر الفروع", "Inventory Organization Across Branches")}</h1>
        <p className="text-gray-500 mt-2">{tc("مراقبة شاملة للمخزون والتوزيع في جميع الفروع", "Comprehensive inventory monitoring and distribution across all branches")}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{tc("عدد الفروع", "Number of Branches")}</p>
                <p className="text-2xl font-bold">{stats?.totalBranches || 0}</p>
              </div>
              <Warehouse className="w-8 h-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{tc("عدد المنتجات", "Number of Products")}</p>
                <p className="text-2xl font-bold">{stats?.totalSKUs || 0}</p>
              </div>
              <Package className="w-8 h-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{tc("قيمة المخزون", "Inventory Value")}</p>
                <p className="text-2xl font-bold">{stats?.totalInventoryValue ? `${Math.round(stats.totalInventoryValue)}` : '0'}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{tc("مخزون ناقص", "Low Stock")}</p>
                <p className="text-2xl font-bold text-red-600">{stats?.lowStockItems || 0}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-500 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{tc("تحويلات قيد الانتظار", "Pending Transfers")}</p>
                <p className="text-2xl font-bold text-orange-600">{stats?.pendingTransfers || 0}</p>
              </div>
              <Truck className="w-8 h-8 text-orange-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branches Overview */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="overview">{tc("نظرة عامة", "Overview")}</TabsTrigger>
          <TabsTrigger value="transfers">{tc("التحويلات", "Transfers")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats?.branches.map((branch) => (
              <Card
                key={branch.branchId}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedBranch(branch.branchId)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{branch.branchName}</CardTitle>
                  {branch.lowStockItems > 0 && (
                    <Badge variant="destructive" className="w-fit">
                      {branch.lowStockItems} منتج ناقص
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{tc("عدد المنتجات:", "Products:")}</span>
                    <span className="font-semibold">{branch.totalItems}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{tc("قيمة المخزون:", "Inventory Value:")}</span>
                    <span className="font-semibold">{Math.round(branch.totalValue)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">{tc("التحويلات الحديثة:", "Recent Transfers:")}</span>
                    <span className="font-semibold">{branch.recentTransfers}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader>
              <CardTitle>{tc("التحويلات الفعلية", "Actual Transfers")}</CardTitle>
              <CardDescription>
                لعرض التحويلات الفعلية، اذهب إلى صفحة إدارة التحويلات
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                يمكنك إدارة التحويلات بين الفروع من خلال قسم المشتريات والنقل
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
