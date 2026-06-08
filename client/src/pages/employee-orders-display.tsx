import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, ChefHat, CheckCircle2, ArrowLeft } from "lucide-react";
import type { Employee } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import qiroxLogoStaff from "@assets/qirox-logo-customer.png";
import { useTranslate } from "@/lib/useTranslate";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
  tableNumber?: string;
  carInfo?: {
    model: string;
    color: string;
    plateNumber: string;
  };
  totalAmount: number;
  branchId?: string;
  createdAt?: string;
  items?: any[];
}

const MAX_ORDERS_PER_STATUS = 5;
const REFRESH_INTERVAL = 5000;

export default function EmployeeOrdersDisplay() {
  const [, setLocation] = useLocation();
  const tc = useTranslate();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [branches, setBranches] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    if (storedEmployee) {
      const emp = JSON.parse(storedEmployee);
      setEmployee(emp);
      if (emp.branchId) {
        setSelectedBranch(emp.branchId);
      }
    } else {
      setLocation("/employee/login");
    }
  }, [setLocation]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const response = await fetch("/api/branches");
        if (response.ok) {
          const data = await response.json();
          setBranches(data);
        }
      } catch (error) {
        console.error("Error fetching branches:", error);
      }
    };
    fetchBranches();
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!selectedBranch) return;
    try {
      setIsLoading(true);
      const response = await fetch(`/api/orders?branchId=${selectedBranch}`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const getLastThreeDigits = (orderNumber: string) => {
    const numbers = orderNumber.replace(/\D/g, "");
    return numbers.slice(-3) || orderNumber.slice(-3);
  };

  const filterOrdersByStatus = (status: string) => {
    return orders
      .filter((order) => order.status === status || (status === "pending" && order.status === "waiting"))
      .slice(0, MAX_ORDERS_PER_STATUS);
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: tc("قيد الانتظار", "Pending"),
      waiting: tc("قيد الانتظار", "Pending"),
      preparing: tc("جاري التحضير", "Preparing"),
      in_progress: tc("جاري التحضير", "Preparing"),
      ready: tc("جاهز للاستلام", "Ready"),
    };
    return labels[status] || status;
  };

  const getStatusBgColor = (statusSection: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-50",
      preparing: "bg-blue-50",
      ready: "bg-green-50",
    };
    return colors[statusSection] || "bg-muted/30";
  };

  const getStatusBorderColor = (statusSection: string) => {
    const colors: Record<string, string> = {
      pending: "border-yellow-300",
      preparing: "border-blue-300",
      ready: "border-green-300",
    };
    return colors[statusSection] || "border-border";
  };

  const getOrderCardBg = (statusSection: string) => {
    const colors: Record<string, string> = {
      pending: "bg-card border-l-4 border-l-yellow-400",
      preparing: "bg-card border-l-4 border-l-blue-400",
      ready: "bg-card border-l-4 border-l-green-400",
    };
    return colors[statusSection] || "bg-card border-l-4 border-l-border";
  };

  const OrderCard = ({ order, statusSection }: { order: Order; statusSection: string }) => (
    <div className={`p-3 rounded-lg shadow-sm ${getOrderCardBg(statusSection)} hover:shadow-md transition-shadow min-w-0`}>
      <div className="text-center flex flex-col items-center justify-center overflow-hidden">
        <div className="flex justify-between items-start w-full mb-1">
          {order.orderType === 'dine-in' && order.tableNumber && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              {tc("طاولة", "Table")} {order.tableNumber}
            </Badge>
          )}
          {order.orderType === 'car-pickup' && order.carInfo && (
            <Badge variant="outline" className="text-[10px] bg-blue-100 text-blue-700 border-blue-200">
              {tc("سيارة:", "Car:")} {order.carInfo.model} ({order.carInfo.color}) - {order.carInfo.plateNumber}
            </Badge>
          )}
          <span className="text-[10px] text-muted-foreground">{new Date(order.createdAt || "").toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p className="text-3xl sm:text-4xl font-bold text-foreground font-mono mb-1 truncate w-full">
          {getLastThreeDigits(order.orderNumber)}
        </p>
        <div className="flex items-center justify-center gap-1 flex-wrap w-full">
          <p className="text-base sm:text-lg font-bold text-foreground leading-none truncate max-w-[70%]">
            {order.totalAmount}
          </p>
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground leading-none shrink-0"><SarIcon /></p>
        </div>
      </div>
    </div>
  );

  const StatusSection = ({ title, status, icon: Icon, count }: { title: string; status: string; icon: any; count: number }) => {
    const orders_list = filterOrdersByStatus(status);
    return (
      <div>
        <div className={`flex items-center gap-2 mb-4 pb-3 border-b-2 ${getStatusBorderColor(status)}`}>
          <Icon className="w-6 h-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold text-foreground">{title}</h2>
          <span className="text-xl font-semibold text-muted-foreground ml-2">({count})</span>
        </div>
        <div className={`p-4 rounded-lg border-2 ${getStatusBgColor(status)} ${getStatusBorderColor(status)} min-h-40`}>
          {orders_list.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {orders_list.map((order) => (
                <OrderCard key={order.id} order={order} statusSection={status} />
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8 font-semibold">{tc("لا توجد طلبات", "No orders")}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="flex items-center justify-between mb-8 bg-card rounded-lg border border-border p-4">
        <Button
          onClick={() => setLocation("/employee/home")}
          size="icon"
          variant="ghost"
          data-testid="button-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <img src={qiroxLogoStaff} alt="مكان الشيف" className="w-8 h-8 object-contain rounded-lg" />
          <h1 className="text-3xl font-bold text-foreground">{tc("عرض الطلبات", "Orders Display")}</h1>
        </div>
        <div className="w-10" />
      </div>

      {!selectedBranch && (
        <div className="bg-card rounded-lg border border-border p-4 mb-6">
          <label className="block text-sm font-semibold text-foreground mb-2">
            {tc("اختر الفرع", "Select Branch")}
          </label>
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-full border-2 border-border text-base h-12" data-testid="select-branch">
              <SelectValue placeholder={tc("اختر الفرع", "Select Branch")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.nameAr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isLoading && selectedBranch ? (
        <div className="text-center py-8">
          <p className="text-lg text-muted-foreground font-semibold">{tc("جاري تحميل الطلبات...", "Loading orders...")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <StatusSection
            title={tc("قيد الانتظار", "Pending")}
            status="pending"
            icon={Clock}
            count={filterOrdersByStatus("pending").length}
          />
          <StatusSection
            title={tc("جاري التحضير", "Preparing")}
            status="preparing"
            icon={ChefHat}
            count={filterOrdersByStatus("preparing").length + filterOrdersByStatus("in_progress").length}
          />
          <StatusSection
            title={tc("جاهز للاستلام", "Ready")}
            status="ready"
            icon={CheckCircle2}
            count={filterOrdersByStatus("ready").length}
          />
        </div>
      )}
    </div>
  );
}
