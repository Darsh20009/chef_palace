import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowRight, Coffee, Droplet, Cherry, Snowflake, Leaf, Sparkles, Package, Wrench, ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { RawItem, Employee } from "@shared/schema";
import { useTranslate } from "@/lib/useTranslate";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const getIngredientIcon = (nameAr: string, category?: string) => {
  if (category === 'packaging') return Package;
  if (category === 'equipment') return Wrench;
  if (category === 'consumable') return ShoppingBag;
  
  const iconMap: Record<string, any> = {
    "حليب": Droplet,
    "حبوب البن": Coffee,
    "بن مطحون": Coffee,
    "شوكولاتة": Cherry,
    "حليب مكثف": Droplet,
    "فانيليا": Sparkles,
    "كاكاو": Cherry,
    "كراميل": Droplet,
    "ثلج": Snowflake,
    "ماء": Droplet,
    "شاي": Leaf,
    "نعناع": Leaf,
    "ليمون": Cherry,
    "ماتشا": Leaf,
    "كيك": Cherry,
    "كريمة": Droplet,
    "بسكويت": Cherry
  };
  return iconMap[nameAr] || Coffee;
};

export default function EmployeeIngredientsManagement() {
  const [, setLocation] = useLocation();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("ingredient");
  const { toast } = useToast();
  const tc = useTranslate();

  const categoryLabels: Record<string, string> = {
    ingredient: tc("المكونات", "Ingredients"),
    packaging:  tc("التغليف", "Packaging"),
    consumable: tc("المستهلكات", "Consumables"),
    equipment:  tc("المعدات", "Equipment"),
    other:      tc("أخرى", "Other"),
  };

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      setEmployee(JSON.parse(storedEmployee));
    } else {
      setLocation("/employee/gateway");
    }
  }, [setLocation]);

  const { data: rawItems = [], isLoading } = useQuery<RawItem[]>({
    queryKey: ["/api/employee/raw-items/by-category", activeCategory],
    queryFn: async () => {
      const response = await fetch(`/api/employee/raw-items/by-category/${activeCategory}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error("Failed to fetch items");
      return response.json();
    },
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: number }) => {
      const response = await fetch(`/api/employee/raw-items/${id}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) throw new Error("Failed to update item");
      return response.json();
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/employee/raw-items/by-category", activeCategory] });
      const previousItems = queryClient.getQueryData(["/api/employee/raw-items/by-category", activeCategory]);
      
      queryClient.setQueryData(["/api/employee/raw-items/by-category", activeCategory], (old: any) =>
        old?.map((item: any) =>
          item.id === id ? { ...item, isActive } : item
        )
      );
      
      return { previousItems };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee/raw-items/by-category", activeCategory] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/raw-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
      
      toast({
        title: tc("تم التحديث بنجاح", "Updated Successfully"),
        description: tc("تم تحديث حالة توفر المادة", "Item availability updated"),
      });
    },
    onError: (error, variables, context: any) => {
      if (context?.previousItems) {
        queryClient.setQueryData(["/api/employee/raw-items/by-category", activeCategory], context.previousItems);
      }
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل تحديث حالة توفر المادة", "Failed to update item availability"),
        variant: "destructive",
      });
    },
  });

  const handleToggleAvailability = (item: RawItem) => {
    const newAvailability = item.isActive === 1 ? 0 : 1;
    updateAvailabilityMutation.mutate({ id: item.id, isActive: newAvailability });
  };

  if (!employee) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-primary text-primary-foreground p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold mb-2">{tc("إدارة المواد الخام", "Raw Materials Management")}</h1>
              <p className="text-accent">{tc("مرحباً،", "Hello,")} {employee.fullName}</p>
            </div>
            <Button 
              onClick={() => setLocation("/employee/menu")}
              variant="secondary"
              size="lg"
              className="gap-2"
              data-testid="button-back-to-menu"
            >
              <ArrowRight className="w-5 h-5" />
              {tc("العودة للقائمة", "Back to Menu")}
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <div className="bg-card rounded-lg border border-border border-r-4 border-r-primary p-4">
            <p className="text-gray-700 dark:text-gray-300">
              <strong>{tc("تنبيه:", "Notice:")}</strong> {tc("عند تعطيل أي مادة، سيتم تلقائياً التأثير على جميع المشروبات التي تحتوي على هذه المادة في وصفاتها.", "Disabling any ingredient will automatically affect all drinks that include it in their recipes.")}
            </p>
          </div>
        </div>

        <Tabs value={activeCategory} onValueChange={setActiveCategory} className="mb-6">
          <TabsList className="grid grid-cols-3 lg:grid-cols-5 gap-2 h-auto p-2 bg-card">
            {(["ingredient", "packaging", "consumable", "equipment", "other"] as const).map((cat) => (
              <TabsTrigger 
                key={cat}
                value={cat}
                className="data-[state=active]:bg-primary data-[state=active]:text-white"
                data-testid={`tab-${cat}`}
              >
                {categoryLabels[cat]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {rawItems.map((item) => {
              const Icon = getIngredientIcon(item.nameAr, item.category);
              const isAvailable = item.isActive === 1;
              
              return (
                <Card 
                  key={item.id} 
                  className={`group relative overflow-visible transition-all duration-300 ${
                    isAvailable 
                      ? 'bg-card border-2 border-primary' 
                      : 'bg-gray-100 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-700 opacity-75'
                  }`}
                  data-testid={`card-raw-item-${item.id}`}
                >
                  <div className={`absolute inset-0 rounded-lg bg-gradient-to-br ${
                    isAvailable 
                      ? 'from-primary/5 to-background dark:from-primary/20 dark:to-background' 
                      : 'from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800'
                  } opacity-50`} />
                  
                  <CardContent className="relative p-6">
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className={`p-3 rounded-full ${
                        isAvailable 
                          ? 'bg-gradient-to-br from-primary to-primary/80' 
                          : 'bg-gray-400'
                      } shadow-lg`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <Badge 
                        variant={isAvailable ? "default" : "secondary"}
                        className={`${isAvailable ? 'bg-green-500' : 'bg-red-500'} text-white`}
                        data-testid={`badge-status-${item.id}`}
                      >
                        {isAvailable ? tc("متوفر", "Available") : tc("غير متوفر", "Unavailable")}
                      </Badge>
                    </div>

                    <div className="mb-4">
                      <h3 className="text-xl font-bold text-gray-800 dark:text-foreground mb-1" data-testid={`text-name-${item.id}`}>
                        {item.nameAr}
                      </h3>
                      {item.nameEn && (
                        <p className="text-sm text-gray-500 dark:text-muted-foreground">{item.nameEn}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {item.code}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {tc("الحالة", "Status")}
                      </span>
                      <Switch
                        checked={isAvailable}
                        onCheckedChange={() => handleToggleAvailability(item)}
                        disabled={updateAvailabilityMutation.isPending}
                        className="data-[state=checked]:bg-green-500"
                        data-testid={`switch-availability-${item.id}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && rawItems.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-block p-6 bg-white dark:bg-gray-800 rounded-full shadow-lg mb-4">
              <Coffee className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {tc("لا توجد مواد في هذه الفئة", "No items in this category")}
            </h3>
            <p className="text-gray-500 dark:text-muted-foreground">
              {tc("لم يتم إضافة أي مواد خام في فئة", "No raw materials have been added to the")} {categoryLabels[activeCategory]} {tc("بعد", "category yet")}
            </p>
          </div>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
}
