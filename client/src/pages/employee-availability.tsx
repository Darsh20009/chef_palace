import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import type { CoffeeItem } from "@shared/schema";
import { Coffee } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

export default function EmployeeAvailability() {
  const { toast } = useToast();
  const tc = useTranslate();
  const [selectedStatus, setSelectedStatus] = useState<{[key: string]: string}>({});

  const { data: items = [], isLoading } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: async (data: { itemId: string; availabilityStatus: string }) => {
      const res = await fetch(`/api/coffee-items/${data.itemId}/availability`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilityStatus: data.availabilityStatus }),
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coffee-items"] });
      toast({
        title: tc("تم التحديث", "Updated"),
        description: tc("تم تحديث حالة الطبق بنجاح", "Item availability updated successfully"),
      });
    },
    onError: () => {
      toast({
        title: tc("خطأ", "Error"),
        description: tc("فشل تحديث حالة الطبق", "Failed to update item status"),
        variant: "destructive",
      });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{tc("جاري التحميل...", "Loading...")}</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="font-amiri text-3xl font-bold text-primary flex items-center gap-2">
            <Coffee className="w-8 h-8" />
            {tc("إدارة توفر الأطباق", "Manage Drink Availability")}
          </h1>
          <p className="text-muted-foreground mt-2">
            {tc("تغيير حالة توفر الأطباق (متاح / نفذت الكمية / قريباً)", "Change drink availability (Available / Out of Stock / Coming Soon)")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <Card key={item.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-amiri text-right">{item.nameAr}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <Badge
                    variant={item.availabilityStatus === 'available' || !item.availabilityStatus ? 'default' : 'secondary'}
                    className={item.availabilityStatus === 'available' || !item.availabilityStatus ? 'bg-green-500 hover:bg-green-600' : ''}
                  >
                    {tc("متوفر", "Available")}
                  </Badge>
                  {item.availabilityStatus === 'out_of_stock' && <Badge variant="destructive">{tc("نفذت الكمية", "Out of Stock")}</Badge>}
                  {item.availabilityStatus === 'coming_soon' && <Badge variant="secondary" className="bg-blue-500 text-white">{tc("قريباً", "Coming Soon")}</Badge>}
                  {item.availabilityStatus === 'temporarily_unavailable' && <Badge variant="outline" className="text-orange-500 border-orange-500">{tc("غير متوفر حالياً", "Temporarily Unavailable")}</Badge>}
                  {item.availabilityStatus === 'new' && <Badge variant="default" className="bg-purple-500 animate-pulse">{tc("جديد", "New")}</Badge>}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'available' || !item.availabilityStatus ? 'default' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'available' })}
                  >{tc("متوفر", "Available")}</Button>
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'out_of_stock' ? 'destructive' : 'outline'}
                    className="h-8 text-xs"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'out_of_stock' })}
                  >{tc("نفذ", "Out")}</Button>
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'coming_soon' ? 'default' : 'outline'}
                    className="h-8 text-xs bg-blue-500 hover:bg-blue-600"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'coming_soon' })}
                  >{tc("قريباً", "Soon")}</Button>
                  <Button
                    size="sm"
                    variant={item.availabilityStatus === 'new' ? 'default' : 'outline'}
                    className="h-8 text-xs bg-purple-500 hover:bg-purple-600"
                    onClick={() => updateAvailabilityMutation.mutate({ itemId: item.id, availabilityStatus: 'new' })}
                  >{tc("جديد", "New")}</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {items.length === 0 && (
          <div className="text-center py-12">
            <Coffee className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground text-lg">{tc("لا توجد أطباق", "No items found")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
