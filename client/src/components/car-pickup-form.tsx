import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Car, Save, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Order, Customer } from "@shared/schema";
import { motion } from "framer-motion";

interface CarPickupFormProps {
  order: Order;
  customer?: Customer;
}

export function CarPickupForm({ order, customer }: CarPickupFormProps) {
  const { toast } = useToast();
  const customerId = customer?.id;

  const [carType, setCarType] = useState(customer?.carType || "");
  const [carColor, setCarColor] = useState(customer?.carColor || "");
  const [saveCarInfo, setSaveCarInfo] = useState(customer?.saveCarInfo === 1);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [arrivedNotified, setArrivedNotified] = useState(!!(order as any).customerArrived);

  const updateCarPickupMutation = useMutation({
    mutationFn: async (data: { carType: string; carColor: string }) => {
      return await apiRequest("POST", `/api/orders/${order.id}/car-pickup`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "orders"] });
      setFormSubmitted(true);
      toast({
        title: "تم حفظ معلومات السيارة",
        description: "الآن أخبرنا عند وصولك",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ معلومات السيارة",
      });
    }
  });

  const updateCustomerCarMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) return;
      return await apiRequest("PATCH", `/api/customers/${customerId}`, {
        carType,
        carColor,
        saveCarInfo: saveCarInfo ? 1 : 0
      });
    }
  });

  const customerArrivedMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", `/api/orders/${order.id}/customer-arrived`, {});
    },
    onSuccess: () => {
      setArrivedNotified(true);
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customerId, "orders"] });
      toast({
        title: "✅ تم إعلام المطعم بوصولك",
        description: "سيتم توصيل طلبك إليك خلال لحظات",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "تعذر الإعلام، يرجى المحاولة مرة أخرى",
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!carType.trim() || !carColor.trim()) {
      toast({
        variant: "destructive",
        title: "خطأ",
        description: "يرجى إدخال نوع السيارة ولونها",
      });
      return;
    }

    try {
      await updateCarPickupMutation.mutateAsync({ carType, carColor });
      if (saveCarInfo && customerId) {
        await updateCustomerCarMutation.mutateAsync();
      }
    } catch (error) {
      console.error("Error updating car pickup:", error);
    }
  };

  const savedCarType = (order as any).carType || (order as any).carInfo?.carType || "";
  const savedCarColor = (order as any).carColor || (order as any).carInfo?.carColor || "";
  const savedPlate = (order as any).plateNumber || (order as any).carInfo?.plateNumber || (order as any).carPlate || "";

  const ArrivalButton = () => (
    <div className="mt-4">
      {arrivedNotified ? (
        <div className="flex items-center gap-2 p-3 bg-green-900/30 rounded-lg border border-green-500/40 text-green-400 text-sm font-bold">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          تم إعلام المطعم بوصولك — سيصلك الطلب قريباً
        </div>
      ) : (
        <Button
          onClick={() => customerArrivedMutation.mutate()}
          disabled={customerArrivedMutation.isPending}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-base py-5"
          data-testid="button-customer-arrived"
        >
          {customerArrivedMutation.isPending ? (
            "جاري الإعلام..."
          ) : (
            <>
              <MapPin className="ml-2 h-5 w-5" />
              أنا وصلت — أعلمنا بوصولك
            </>
          )}
        </Button>
      )}
    </div>
  );

  if ((order.carPickup || savedCarType) && savedCarType) {
    return (
      <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-purple-500/20">
              <Car className="w-6 h-6 text-purple-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-purple-400 mb-2">معلومات السيارة</h3>
              <div className="space-y-1 text-sm text-gray-300">
                {savedCarType && <p><strong className="text-purple-400">النوع:</strong> {savedCarType}</p>}
                {savedCarColor && <p><strong className="text-purple-400">اللون:</strong> {savedCarColor}</p>}
                {savedPlate && <p><strong className="text-purple-400">اللوحة:</strong> {savedPlate}</p>}
              </div>
              <div className="mt-3 p-3 bg-purple-900/30 rounded-lg border border-purple-500/20">
                <p className="text-xs text-purple-300">
                  <AlertCircle className="w-4 h-4 inline ml-1" />
                  سيقوم الموظف بتوصيل طلبك إلى سيارتك
                </p>
              </div>
              <ArrivalButton />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-purple-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-400">
            <Car className="w-5 h-5" />
            استلام من السيارة
          </CardTitle>
          <p className="text-sm text-gray-400">
            أدخل معلومات سيارتك لتوصيل الطلب إليك
          </p>
        </CardHeader>
        <CardContent>
          {formSubmitted ? (
            <ArrivalButton />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="carType" className="text-gray-300">نوع السيارة</Label>
                <Input
                  id="carType"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                  placeholder="مثال: كامري، سوناتا، اكورد"
                  className="bg-gray-800/50 border-gray-700 text-white"
                  data-testid="input-car-type"
                />
              </div>

              <div>
                <Label htmlFor="carColor" className="text-gray-300">لون السيارة</Label>
                <Input
                  id="carColor"
                  value={carColor}
                  onChange={(e) => setCarColor(e.target.value)}
                  placeholder="مثال: أبيض، أسود، فضي"
                  className="bg-gray-800/50 border-gray-700 text-white"
                  data-testid="input-car-color"
                />
              </div>

              {customerId && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="saveCarInfo"
                    checked={saveCarInfo}
                    onCheckedChange={(checked) => setSaveCarInfo(checked as boolean)}
                    className="border-gray-600"
                    data-testid="checkbox-save-car-info"
                  />
                  <Label htmlFor="saveCarInfo" className="text-sm text-gray-300 cursor-pointer">
                    حفظ معلومات السيارة للطلبات المستقبلية
                  </Label>
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                disabled={updateCarPickupMutation.isPending}
                data-testid="button-submit-car-info"
              >
                {updateCarPickupMutation.isPending ? (
                  <>جاري الحفظ...</>
                ) : (
                  <>
                    <Save className="ml-2 h-4 w-4" />
                    حفظ معلومات السيارة
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
