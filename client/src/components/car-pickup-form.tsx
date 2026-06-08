import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Car, Save, AlertCircle, CheckCircle2, MapPin } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";
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
  const tc = useTranslate();
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
        title: tc("تم حفظ معلومات السيارة", "Car Info Saved"),
        description: tc("الآن أخبرنا عند وصولك", "Now let us know when you arrive"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: tc("خطأ", "Error"),
        description: tc("حدث خطأ أثناء حفظ معلومات السيارة", "An error occurred while saving car info"),
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
        title: tc("✅ تم إعلام الكافيه بوصولك", "✅ Café Notified of Your Arrival"),
        description: tc("سيتم توصيل طلبك إليك خلال لحظات", "Your order will be delivered to you shortly"),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: tc("خطأ", "Error"),
        description: tc("تعذر الإعلام، يرجى المحاولة مرة أخرى", "Failed to notify, please try again"),
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!carType.trim() || !carColor.trim()) {
      toast({
        variant: "destructive",
        title: tc("خطأ", "Error"),
        description: tc("يرجى إدخال نوع السيارة ولونها", "Please enter your car type and color"),
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
          {tc("تم إعلام الكافيه بوصولك — سيصلك الطلب قريباً", "Café notified of your arrival — order coming shortly")}
        </div>
      ) : (
        <Button
          onClick={() => customerArrivedMutation.mutate()}
          disabled={customerArrivedMutation.isPending}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-base py-5"
          data-testid="button-customer-arrived"
        >
          {customerArrivedMutation.isPending ? (
            tc("جاري الإعلام...", "Notifying...")
          ) : (
            <>
              <MapPin className="ml-2 h-5 w-5" />
              {tc("أنا وصلت — أعلمنا بوصولك", "I've Arrived — Notify the Café")}
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
              <h3 className="text-lg font-bold text-purple-400 mb-2">{tc("معلومات السيارة", "Car Info")}</h3>
              <div className="space-y-1 text-sm text-gray-300">
                {savedCarType && <p><strong className="text-purple-400">{tc("النوع:", "Type:")}</strong> {savedCarType}</p>}
                {savedCarColor && <p><strong className="text-purple-400">{tc("اللون:", "Color:")}</strong> {savedCarColor}</p>}
                {savedPlate && <p><strong className="text-purple-400">{tc("اللوحة:", "Plate:")}</strong> {savedPlate}</p>}
              </div>
              <div className="mt-3 p-3 bg-purple-900/30 rounded-lg border border-purple-500/20">
                <p className="text-xs text-purple-300">
                  <AlertCircle className="w-4 h-4 inline ml-1" />
                  {tc("سيقوم الموظف بتوصيل طلبك إلى سيارتك", "A staff member will deliver your order to your car")}
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
            {tc("استلام من السيارة", "Car Pickup")}
          </CardTitle>
          <p className="text-sm text-gray-400">
            {tc("أدخل معلومات سيارتك لتوصيل الطلب إليك", "Enter your car info so we can deliver to you")}
          </p>
        </CardHeader>
        <CardContent>
          {formSubmitted ? (
            <ArrivalButton />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="carType" className="text-gray-300">{tc("نوع السيارة", "Car Type")}</Label>
                <Input
                  id="carType"
                  value={carType}
                  onChange={(e) => setCarType(e.target.value)}
                  placeholder={tc("مثال: كامري، سوناتا، اكورد", "e.g. Camry, Sonata, Accord")}
                  className="bg-gray-800/50 border-gray-700 text-white"
                  data-testid="input-car-type"
                />
              </div>

              <div>
                <Label htmlFor="carColor" className="text-gray-300">{tc("لون السيارة", "Car Color")}</Label>
                <Input
                  id="carColor"
                  value={carColor}
                  onChange={(e) => setCarColor(e.target.value)}
                  placeholder={tc("مثال: أبيض، أسود، فضي", "e.g. White, Black, Silver")}
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
                    {tc("حفظ معلومات السيارة للطلبات المستقبلية", "Save car info for future orders")}
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
                  <>{tc("جاري الحفظ...", "Saving...")}</>
                ) : (
                  <>
                    <Save className="ml-2 h-4 w-4" />
                    {tc("حفظ معلومات السيارة", "Save Car Info")}
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
