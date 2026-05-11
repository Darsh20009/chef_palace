import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Wifi, WifiOff, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useTranslate } from "@/lib/useTranslate";

interface ServiceStatus {
  provider: string;
  status: 'connected' | 'disconnected' | 'warning';
  latency?: string;
  ordersToday?: number;
  lastActive?: string;
}

export default function DeliveryServiceStatusPage() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const tc = useTranslate();

  const { data: services = [], refetch } = useQuery<ServiceStatus[]>({
    queryKey: ["/api/integrations/delivery/service-status"],
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500">{tc("متصل", "Connected")}</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">{tc("غير متصل", "Disconnected")}</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">{tc("تحذير", "Warning")}</Badge>;
      default:
        return <Badge>{tc("غير معروف", "Unknown")}</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">{tc("حالة خدمات التوصيل", "Delivery Service Status")}</h1>
          <p className="text-gray-500 mt-2">{tc("مراقبة اتصال خدمات التوصيل والشركاء", "Monitor delivery service connectivity and partners")}</p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {tc("تحديث", "Refresh")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <Card key={service.provider}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-lg capitalize">{service.provider}</CardTitle>
              {service.status === 'connected' ? (
                <Wifi className="w-5 h-5 text-green-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-500" />
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">{tc("الحالة:", "Status:")}</span>
                {getStatusBadge(service.status)}
              </div>

              {service.latency && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <Clock className="w-4 h-4 mr-1" />
                    {tc("الاستجابة:", "Latency:")}
                  </span>
                  <span className="text-sm font-mono">{service.latency}</span>
                </div>
              )}

              {service.ordersToday !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{tc("طلبات اليوم:", "Today's Orders:")}</span>
                  <span className="text-sm font-bold">{service.ordersToday}</span>
                </div>
              )}

              {service.lastActive && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{tc("آخر نشاط:", "Last Active:")}</span>
                  <span className="text-sm text-gray-500">{service.lastActive}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 border-t">
                {service.status === 'connected' ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${service.status === 'connected' ? 'text-green-700' : 'text-red-700'}`}>
                  {service.status === 'connected'
                    ? tc("الخدمة تعمل بشكل طبيعي", "Service is operating normally")
                    : tc("الخدمة غير متاحة", "Service unavailable")}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {services.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center text-gray-500">
            <WifiOff className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>{tc("لا توجد بيانات خدمات", "No service data available")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
