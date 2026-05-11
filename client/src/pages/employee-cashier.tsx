import { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, getErrorMessage } from "@/lib/queryClient";
import { cacheMenuItems, getCachedMenuItems, savePendingOrder, getPendingOrdersCount, getPendingOrders, updatePendingOrderReceiptData, syncPendingOrders, type PendingOrder } from "@/lib/offline-cashier";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Coffee, ShoppingBag, User, Phone, Trash2, Plus, Minus, ArrowRight, Check, Scan, Search, X, Gift, Printer, MonitorSmartphone, Settings, Wifi, WifiOff, FileText, Store, Truck, MapPin, Wallet, CreditCard } from "lucide-react";
const chefsplaceLogoStaff = "/logo.png";
import QRScanner from "@/components/qr-scanner";
import BarcodeScanner from "@/components/barcode-scanner";
import { TableOccupancyAlerts } from "@/components/table-occupancy-alerts";
import { ClassicCashierLayout, POSCashierLayout, SplitCashierLayout } from "@/components/cashier-layouts";
import { printTaxInvoice, printCustomerPickupReceipt, printCashierReceipt, printAllReceipts, fmtOrderNum } from "@/lib/print-utils";
import type { Employee, CoffeeItem, PaymentMethod, LoyaltyCard } from "@shared/schema";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import PrinterSettingsPanel from "@/components/printer-settings-panel";

interface OrderItem {
 coffeeItem: CoffeeItem;
 quantity: number;
 customization?: {
   selectedSize?: string;
   addons?: any[];
   totalAddonsPrice?: number;
 };
}

interface WhatsAppMessageData {
 phone: string;
 orderNumber: string;
 customerName: string;
 items: OrderItem[];
 total: string;
 paymentMethod: string;
}

function generateWhatsAppLink(data: WhatsAppMessageData): string {
 const message = `
مرحباً ${data.customerName}

تم استلام طلبك بنجاح!

رقم الطلب: ${fmtOrderNum(data.orderNumber)}

تفاصيل الطلب:
${data.items.map(item => {
  let price = Number(item.coffeeItem.price) || 0;
  if ((item as any).selectedSize && item.coffeeItem.availableSizes) {
    const sz = (item.coffeeItem.availableSizes as any[]).find((s: any) => s.nameAr === (item as any).selectedSize);
    if (sz) price = Number(sz.price) || price;
  }
  const addonsExtra = ((item.customization as any)?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
  return `• ${item.coffeeItem.nameAr}${(item as any).selectedSize ? ` (${(item as any).selectedSize})` : ''} × ${item.quantity} - ${((price + addonsExtra) * item.quantity).toFixed(2)} ريال`;
}).join('\n')}

الإجمالي: ${data.total} ريال
طريقة الدفع: ${data.paymentMethod}

حالة الطلب: تحت التنفيذ

سنبلغك عند اكتمال طلبك. شكراً لتعاملك معنا!

مكان الشيف البخاري
`.trim();

 const phoneNumber = data.phone.replace(/[^0-9]/g, '');
 const internationalPhone = phoneNumber.startsWith('966') ? phoneNumber : `966${phoneNumber.replace(/^0/, '')}`;
 
 return `https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`;
}

export default function EmployeeCashier() {
 const tc = useTranslate();
 const [, setLocation] = useLocation();
 const [employee, setEmployee] = useState<Employee | null>(null);
 const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
 const [customerName, setCustomerName] = useState("");
 const [customerPhone, setCustomerPhone] = useState("");
 const [customerEmail, setCustomerEmail] = useState("");
 const [customerPoints, setCustomerPoints] = useState(0);
 const [customerId, setCustomerId] = useState<string | null>(null);
 const [showRegisterDialog, setShowRegisterDialog] = useState(false);
 const [tableNumber, setTableNumber] = useState("");
 const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
 const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);
 const [isRegisteringCustomer, setIsRegisteringCustomer] = useState(false);
 const [loyaltyCard, setLoyaltyCard] = useState<LoyaltyCard | null>(null);
 const [discountCode, setDiscountCode] = useState("");
 const [appliedDiscount, setAppliedDiscount] = useState<{code: string, percentage: number, reason: string} | null>(null);
 const [isValidatingDiscount, setIsValidatingDiscount] = useState(false);
 const [lastOrder, setLastOrder] = useState<any>(null);
 const [posConnected, setPosConnected] = useState(false);
 const [isPosSettingsOpen, setIsPosSettingsOpen] = useState(false);
 const [isTogglingPos, setIsTogglingPos] = useState(false);
 const [isPrinterSettingsOpen, setIsPrinterSettingsOpen] = useState(false);
 const [stampsToUse, setStampsToUse] = useState(0);
 const [pointsToRedeem, setPointsToRedeem] = useState(0);
 const [usePointsDiscount, setUsePointsDiscount] = useState(false);
 const [orderType, setOrderType] = useState<'dine-in' | 'pickup' | 'delivery'>('pickup');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(getPendingOrdersCount);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  const [pendingOrdersList, setPendingOrdersList] = useState<PendingOrder[]>([]);

 const { toast } = useToast();
 const { i18n } = useTranslation();
 const getItemDisplayName = useCallback((item: any) => {
   if (!item) return '';
   if (i18n.language === 'en') return item.nameEn || item.nameAr || '';
   return item.nameAr || item.nameEn || '';
 }, [i18n.language]);

 const { data: loyaltySettings } = useQuery<any>({
   queryKey: ["/api/public/loyalty-settings"],
   staleTime: 300000,
 });

 const pointsToSar = (pts: number) => {
   const pointsValueInSar = loyaltySettings?.pointsValueInSar ?? 0.05;
   return pts * pointsValueInSar;
 };

 useEffect(() => {
 const loadEmployee = async () => {
 const storedEmployee = localStorage.getItem("currentEmployee");
 if (storedEmployee) {
 const parsed = JSON.parse(storedEmployee);
 // If employee doesn't have branchId, fetch it from server
 if (!parsed.branchId) {
 try {
 const response = await fetch('/api/verify-session');
 if (response.ok) {
 const data = await response.json();
 if (data.employee?.branchId) {
 parsed.branchId = data.employee.branchId;
 localStorage.setItem("currentEmployee", JSON.stringify(parsed));
 }
 }
 } catch (error) {
 console.error("Error fetching branch info:", error);
 }
 }
 
 setEmployee(parsed);
 } else {
 setLocation("/employee/gateway");
 }
 };
 loadEmployee();
 }, [setLocation]);

 // Offline detection and auto-sync
 useEffect(() => {
   const handleOnline = () => {
     setIsOffline(false);
     syncPendingOrders((order) => {
       setPendingOrdersCount(getPendingOrdersCount());
       toast({ title: tc("✅ تمت مزامنة طلب معلق", "✅ Pending order synced"), description: tc("تم إرسال الطلب للخادم بنجاح", "Order sent to server successfully") });
       queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
     });
   };
   const handleOffline = () => {
     setIsOffline(true);
     setPendingOrdersCount(getPendingOrdersCount());
   };
   window.addEventListener('online', handleOnline);
   window.addEventListener('offline', handleOffline);
   return () => {
     window.removeEventListener('online', handleOnline);
     window.removeEventListener('offline', handleOffline);
   };
 }, [toast]);

 // Check POS device connection
 useEffect(() => {
 const checkPosConnection = async () => {
 try {
 const response = await fetch('/api/pos/status', { method: 'GET' });
 if (response.ok) {
 const data = await response.json();
 setPosConnected(data.connected === true);
 } else {
 setPosConnected(false);
 }
 } catch (error) {
 setPosConnected(false);
 }
 };

 // Check POS status every 30 seconds
 checkPosConnection();
 const interval = setInterval(checkPosConnection, 30000);
 return () => clearInterval(interval);
 }, []);

 // Check for existing customer when phone number is entered
 useEffect(() => {
 const checkCustomer = async () => {
 const is9Digit = customerPhone.length === 9 && customerPhone.startsWith('5');
 const is10Digit = customerPhone.length === 10 && customerPhone.startsWith('05');
 const normalizedPhone = is10Digit ? customerPhone.slice(1) : customerPhone;
 if (is9Digit || is10Digit) {
 setIsCheckingCustomer(true);
 try {
 const response = await fetch(`/api/customers/lookup-by-phone`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ phone: normalizedPhone })
 });
 
 if (response.ok) {
 const data = await response.json();
 if (data.found && data.customer) {
 setCustomerName(data.customer.name);
 setCustomerEmail(data.customer.email || "");
 setCustomerPoints(data.customer.points || 0);
 setCustomerId(data.customer.id);
 setLoyaltyCard(data.loyaltyCard || null);
 setShowRegisterDialog(false);
 
 const availableStamps = data.loyaltyCard 
 ? (data.loyaltyCard.freeCupsEarned || 0) - (data.loyaltyCard.freeCupsRedeemed || 0) 
 : 0;
 
 toast({
 title: tc("عميل مسجل", "Customer Found"),
 description: `${tc("مرحباً", "Welcome")} ${data.customer.name}! ${tc("لديك", "You have")} ${data.customer.points || 0} ${tc("نقطة", "pts")}${availableStamps > 0 ? ` ${tc("و", "and")} ${availableStamps} ${tc("أختام متاحة", "stamps")}` : ''}`,
 className: "bg-green-600 text-white",
 });
 } else {
 // Customer not found - show registration dialog
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setShowRegisterDialog(true);
 }
 } else {
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setShowRegisterDialog(true);
 }
 } catch (error) {
 console.error('Error checking customer:', error);
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 } finally {
 setIsCheckingCustomer(false);
 }
 } else {
 // Reset when phone is incomplete
 if (customerPhone.length === 0) {
 setCustomerId(null);
 setLoyaltyCard(null);
 setCustomerName("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setShowRegisterDialog(false);
 }
 }
 };

 const debounceTimer = setTimeout(checkCustomer, 500);
 return () => clearTimeout(debounceTimer);
 }, [customerPhone, toast]);

 const { data: fetchedItems = [], isLoading } = useQuery<CoffeeItem[]>({
   queryKey: ["/api/coffee-items"],
   retry: isOffline ? 0 : 3,
 });
 // Use fetched items or fall back to cached items when offline
 const coffeeItems: CoffeeItem[] = (fetchedItems.length > 0)
   ? fetchedItems
   : getCachedMenuItems() as CoffeeItem[];
 // Cache items whenever fresh data arrives
 useEffect(() => {
   if (fetchedItems.length > 0) cacheMenuItems(fetchedItems);
 }, [fetchedItems]);

 const { data: businessConfig } = useQuery<any>({
   queryKey: ["/api/business-config"],
   staleTime: 300000,
 });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      // Show customer details for confirmation
      const pmLabels: Record<string, string> = { cash: tc("نقداً","Cash"), pos: tc("شبكة","Network"), "pos-network": tc("شبكة","Network"), "qahwa-card": tc("بطاقة مكان الشيف","مكان الشيف البخاري Card"), "loyalty-card": tc("بطاقة ولاء","Loyalty Card") };
      const pmLabel = pmLabels[orderData.paymentMethod] || tc("شبكة","Network");
      const confirmMessage = `تأكيد الدفع (${pmLabel}) للعميل: ${orderData.customerInfo.customerName}\nرقم الجوال: ${orderData.customerInfo.phoneNumber}\nالإجمالي: ${orderData.totalAmount} ريال`;
      if (!window.confirm(confirmMessage)) {
        throw new Error("تم إلغاء تأكيد الدفع");
      }

      // If offline, save order locally and return a fake success response
      if (!navigator.onLine) {
        const pending = savePendingOrder(orderData);
        setPendingOrdersCount(getPendingOrdersCount());
        return { orderNumber: pending.id, offline: true, status: 'pending_sync', totalAmount: orderData.totalAmount };
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(orderData),
      });

      // If response is 202 (queued by service worker offline), treat as pending
      if (response.status === 202) {
        const pending = savePendingOrder(orderData);
        setPendingOrdersCount(getPendingOrdersCount());
        return { orderNumber: pending.id, offline: true, status: 'pending_sync', totalAmount: orderData.totalAmount };
      }
      
      if (!response.ok) {
        throw new Error("Failed to create order");
      }
      
      return response.json();
    },
 onSuccess: async (order) => {
 const paymentMethodAr = paymentMethod === "cash" ? tc("نقدي","Cash") : 
 paymentMethod === "qahwa-card" || paymentMethod === "loyalty-card" ? tc("بطاقة مكان الشيف","مكان الشيف البخاري Card") :
 tc("شبكة","Network");
 
 const orderTypeAr = orderType === 'dine-in' ? tc('في المطعم','Dine-in') :
 orderType === 'pickup' ? tc('استلام','Pickup') : tc('توصيل','Delivery');
 
 setLastOrder({
 orderNumber: order.orderNumber,
 customerName,
 customerPhone,
 items: orderItems,
 subtotal: calculateSubtotal().toFixed(2),
 discount: appliedDiscount ? {
 code: appliedDiscount.code,
 percentage: appliedDiscount.percentage,
 amount: calculateDiscount().toFixed(2)
 } : undefined,
 total: order.totalAmount,
 paymentMethod: paymentMethodAr,
 employeeName: employee?.fullName || "",
 tableNumber: tableNumber || undefined,
 deliveryType: orderType,
 deliveryTypeAr: orderTypeAr,
 date: new Date().toISOString()
 });
 
 const whatsappData: WhatsAppMessageData = {
 phone: customerPhone,
 orderNumber: order.orderNumber,
 customerName,
 items: orderItems,
 total: order.totalAmount,
 paymentMethod: paymentMethodAr
 };
 
 if (order.offline) {
   // Offline order — saved locally, will sync later
   toast({
     title: tc("✅ تم حفظ الطلب محلياً", "✅ Order saved offline"),
     description: tc("لا يوجد اتصال بالإنترنت — سيُرسل الطلب تلقائياً عند الاتصال", "No internet — order will auto-sync when connected"),
     className: "bg-orange-600 text-white",
   });
 } else {
   const whatsappLink = generateWhatsAppLink(whatsappData);
   window.open(whatsappLink, '_blank');
   toast({
     title: tc("تم إنشاء الطلب بنجاح", "Order created successfully"),
     description: `${tc("رقم الطلب","Order #")}: ${fmtOrderNum(order.orderNumber)}`,
     className: "bg-green-600 text-white",
   });
 }
 
 // تحديث قائمةالطلبات في صفحة الطلبات
 await queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
 
 resetForm();
 },
 onError: () => {
 toast({
 title: tc("خطأ", "Error"),
 description: tc("فشل إنشاء الطلب. يرجى المحاولة مرة أخرى", "Failed to create order. Please try again"),
 variant: "destructive",
 });
 },
 });

 const registerCustomerMutation = useMutation({
 mutationFn: async (customerData: { phone: string; name: string; email?: string }) => {
 const response = await fetch("/api/customers/register-by-cashier", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify(customerData),
 });
 
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || tc("فشل تسجيل العميل", "Failed to register customer"));
 }
 
 return response.json();
 },
 onSuccess: async (customer) => {
 setCustomerId(customer.id);
 setCustomerPoints(customer.points || 0);
 setShowRegisterDialog(false);
 
 toast({
 title: tc("تم تسجيل العميل بنجاح", "Customer registered"),
 description: `${tc("تم تسجيل","Registered")} ${customer.name} ${tc("في النظام","in the system")}`,
 className: "bg-green-600 text-white",
 });

 // Fetch loyalty card after registration
 try {
 const loyaltyResponse = await fetch(`/api/loyalty/cards/phone/${customer.phone}`);
 if (loyaltyResponse.ok) {
 const card = await loyaltyResponse.json();
 setLoyaltyCard(card);
 }
 } catch (error) {
 console.error('Error fetching loyalty card after registration:', error);
 }
 },
 onError: (error: Error) => {
 toast({
 title: tc("خطأ في التسجيل", "Registration Error"),
 description: getErrorMessage(error, tc("فشل تسجيل العميل", "Customer registration failed")),
 variant: "destructive",
 });
 },
 });

 const handleRegisterCustomer = () => {
 if (!customerName.trim()) {
 toast({
 title: tc("خطأ", "Error"),
 description: tc("يرجى إدخال اسم العميل", "Please enter customer name"),
 variant: "destructive",
 });
 return;
 }

 registerCustomerMutation.mutate({
 phone: customerPhone,
 name: customerName.trim(),
 email: customerEmail.trim() || undefined,
 });
 };

 const resetForm = () => {
 setOrderItems([]);
 setCustomerName("");
 setCustomerPhone("");
 setCustomerEmail("");
 setCustomerPoints(0);
 setCustomerId(null);
 setLoyaltyCard(null);
 setShowRegisterDialog(false);
 setTableNumber("");
 setPaymentMethod("cash");
 setDiscountCode("");
 setAppliedDiscount(null);
 setOrderType("pickup");
 setPointsToRedeem(0);
 setUsePointsDiscount(false);
 setStampsToUse(0);
 };

 const addToOrder = (coffeeItem: CoffeeItem) => {
   // Since the employee-cashier page doesn't seem to have a DrinkCustomizationDialog state defined like pos-system,
   // we should ideally add it. But for now, let's fix the calculation logic if it's there.
   // Looking at the code, it seems to add directly. 
   const existingItem = orderItems.find(item => item.coffeeItem.id === coffeeItem.id);
   
   if (existingItem) {
     setOrderItems(orderItems.map(item =>
       item.coffeeItem.id === coffeeItem.id
         ? { ...item, quantity: item.quantity + 1 }
         : item
     ));
   } else {
     setOrderItems([...orderItems, { coffeeItem, quantity: 1 }]);
   }
 };

 const updateQuantity = (coffeeItemId: string, newQuantity: number) => {
   if (newQuantity <= 0) {
     setOrderItems(orderItems.filter(item => item.coffeeItem.id !== coffeeItemId));
   } else {
     setOrderItems(orderItems.map(item =>
       item.coffeeItem.id === coffeeItemId
         ? { ...item, quantity: newQuantity }
         : item
     ));
   }
 };

 const removeFromOrder = (coffeeItemId: string) => {
   setOrderItems(orderItems.filter(item => item.coffeeItem.id !== coffeeItemId));
 };

 const calculateSubtotal = () => {
   return orderItems.reduce((sum, item) => {
     let itemPrice = Number(item.coffeeItem.price);
     // Apply size price if available in item (customization check)
     if (item.customization?.selectedSize) {
       const sizeOption = item.coffeeItem.availableSizes?.find(
         s => s.nameAr === item.customization?.selectedSize || s.nameEn === item.customization?.selectedSize
       );
       if (sizeOption) itemPrice = Number(sizeOption.price);
     }
     const addonsPrice = item.customization?.totalAddonsPrice || 0;
     return sum + ((itemPrice + addonsPrice) * item.quantity);
   }, 0);
 };

 const calculateDiscount = () => {
 if (!appliedDiscount) return 0;
 const subtotal = calculateSubtotal();
 return (subtotal * appliedDiscount.percentage) / 100;
 };

 const calculatePointsDiscount = () => {
   if (!usePointsDiscount || pointsToRedeem <= 0) return 0;
   return pointsToSar(pointsToRedeem);
 };

 const calculateTotal = () => {
 const subtotal = calculateSubtotal();
 const discount = calculateDiscount();
 const pointsDiscount = calculatePointsDiscount();
 return Math.max(0, subtotal - discount - pointsDiscount).toFixed(2);
 };

 const validateDiscountCode = async () => {
 if (!discountCode.trim()) {
 toast({
 title: tc("خطأ", "Error"),
 description: tc("يرجى إدخال كود الخصم", "Please enter a discount code"),
 variant: "destructive",
 });
 return;
 }

 setIsValidatingDiscount(true);
 try {
 const response = await fetch('/api/discount-codes/validate', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ code: discountCode })
 });

 let data;
 try {
 data = await response.json();
 } catch (parseError) {
 toast({
 title: tc("خطأ", "Error"),
 description: tc("فشل قراءة استجابة الخادم", "Failed to read server response"),
 variant: "destructive",
 });
 setIsValidatingDiscount(false);
 return;
 }

 if (!response.ok || !data.valid) {
 toast({
 title: tc("كود خصم غير صالح", "Invalid discount code"),
 description: data.error || tc("الكود المدخل غير صحيح أو منتهي الصلاحية", "The code entered is incorrect or expired"),
 variant: "destructive",
 });
 setAppliedDiscount(null);
 setIsValidatingDiscount(false);
 return;
 }

 setAppliedDiscount({
 code: data.code,
 percentage: data.discountPercentage,
 reason: data.reason
 });

 toast({
 title: tc("تم تطبيق الخصم بنجاح", "Discount applied"),
 description: `${data.reason} - ${data.discountPercentage}%`,
 className: "bg-green-600 text-white",
 });
 } catch (error) {
 console.error('Error validating discount code:', error);
 toast({
 title: tc("خطأ", "Error"),
 description: tc("فشل التحقق من كود الخصم", "Failed to validate discount code"),
 variant: "destructive",
 });
 } finally {
 setIsValidatingDiscount(false);
 }
 };

 const removeDiscount = () => {
 setDiscountCode("");
 setAppliedDiscount(null);
 toast({
 title: tc("تم إزالة الخصم", "Discount removed"),
 description: tc("تم إلغاء الخصم من الطلب", "Discount has been removed from the order"),
 });
 };

 const handlePrintReceipt = async () => {
   if (!lastOrder) {
     toast({
       title: tc("خطأ", "Error"),
       description: tc("لا يوجد طلب للطباعة", "No order available to print"),
       variant: "destructive",
     });
     return;
   }
   
   try {
     await printTaxInvoice({
       orderNumber: lastOrder.orderNumber,
       customerName: lastOrder.customerName,
       customerPhone: lastOrder.customerPhone,
       items: lastOrder.items,
       subtotal: lastOrder.subtotal,
       discount: lastOrder.discount,
       total: lastOrder.total,
       paymentMethod: lastOrder.paymentMethod,
       employeeName: lastOrder.employeeName,
       tableNumber: lastOrder.tableNumber,
       date: lastOrder.date,
     }, { autoPrint: true });
     toast({
       title: tc("تم فتح نافذة الطباعة", "Print window opened"),
       description: tc("يمكنك الآن طباعة الإيصال", "You can now print the receipt"),
       className: "bg-green-600 text-white",
     });
   } catch (error) {
     console.error("Error printing receipt:", error);
     toast({
       title: tc("خطأ", "Error"),
       description: tc("فشل في فتح نافذة الطباعة", "Failed to open print window"),
       variant: "destructive",
     });
   }
 };

 const handlePrintTaxInvoice = async () => {
   if (!lastOrder) {
     toast({
       title: tc("خطأ", "Error"),
       description: tc("لا يوجد طلب للطباعة", "No order available to print"),
       variant: "destructive",
     });
     return;
   }
   
   try {
     await printTaxInvoice({
       orderNumber: lastOrder.orderNumber,
       customerName: lastOrder.customerName,
       customerPhone: lastOrder.customerPhone,
       items: lastOrder.items,
       subtotal: lastOrder.subtotal,
       discount: lastOrder.discount,
       total: lastOrder.total,
       paymentMethod: lastOrder.paymentMethod,
       employeeName: lastOrder.employeeName,
       tableNumber: lastOrder.tableNumber,
       date: lastOrder.date,
       crNumber: businessConfig?.commercialRegistration,
       vatNumber: businessConfig?.vatNumber,
     });
     toast({
       title: tc("تم فتح نافذة الطباعة", "Print window opened"),
       description: tc("يمكنك الآن طباعة الفاتورة الضريبية", "You can now print the tax invoice"),
       className: "bg-green-600 text-white",
     });
   } catch (error) {
     console.error("Error printing tax invoice:", error);
     toast({
       title: tc("خطأ", "Error"),
       description: tc("فشل في فتح نافذة الطباعة", "Failed to open print window"),
       variant: "destructive",
     });
   }
 };

 const handlePrintAllReceipts = async () => {
   if (!lastOrder) {
     toast({
       title: tc("خطأ", "Error"),
       description: tc("لا يوجد طلب للطباعة", "No order available to print"),
       variant: "destructive",
     });
     return;
   }
   
   try {
     await printAllReceipts({
       orderNumber: lastOrder.orderNumber,
       customerName: lastOrder.customerName,
       customerPhone: lastOrder.customerPhone,
       items: lastOrder.items,
       subtotal: lastOrder.subtotal,
       discount: lastOrder.discount,
       total: lastOrder.total,
       paymentMethod: lastOrder.paymentMethod,
       employeeName: lastOrder.employeeName,
       tableNumber: lastOrder.tableNumber,
       deliveryType: lastOrder.deliveryType,
       deliveryTypeAr: lastOrder.deliveryTypeAr,
       date: lastOrder.date,
     });
     toast({
       title: tc("تم فتح نوافذ الطباعة", "Print windows opened"),
       description: tc("طباعة 3 إيصالات: فاتورة ضريبية، إيصال استلام، نسخة الكاشير", "Printing 3 receipts: tax invoice, receipt, cashier copy"),
       className: "bg-green-600 text-white",
     });
   } catch (error) {
     console.error("Error printing all receipts:", error);
     toast({
       title: tc("خطأ", "Error"),
       description: tc("فشل في فتح نوافذ الطباعة", "Failed to open print windows"),
       variant: "destructive",
     });
   }
 };

 const handleOpenCashDrawer = async () => {
   try {
     const response = await fetch('/api/pos/cash-drawer/open', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include'
     });
     
     if (response.ok) {
       toast({
         title: tc("تم فتح الخزانة", "Drawer opened"),
         description: tc("تم فتح درج النقود بنجاح", "Cash drawer opened successfully"),
         className: "bg-green-600 text-white",
       });
     } else {
       toast({
         title: tc("خطأ", "Error"),
         description: tc("فشل فتح الخزانة", "Failed to open cash drawer"),
         variant: "destructive",
       });
     }
   } catch (error) {
     console.error('Error opening cash drawer:', error);
     toast({
       title: tc("خطأ", "Error"),
       description: tc("فشل الاتصال بالخادم", "Failed to connect to server"),
       variant: "destructive",
     });
   }
 };

 const handleTogglePosConnection = async () => {
 setIsTogglingPos(true);
 try {
 const response = await fetch('/api/pos/toggle', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include'
 });
 
 if (response.ok) {
 const data = await response.json();
 setPosConnected(data.connected);
 toast({
 title: data.connected ? tc("تم الاتصال بجهاز POS", "POS connected") : tc("تم قطع الاتصال", "POS disconnected"),
 description: data.connected ? tc("الجهاز جاهز للدفع الإلكتروني", "Device ready for payment") : tc("تم إيقاف الاتصال بجهاز POS", "POS connection stopped"),
 className: data.connected ? "bg-green-600 text-white" : undefined,
 });
 } else {
 toast({
 title: tc("خطأ", "Error"),
 description: tc("فشل تغيير حالة الاتصال بجهاز POS", "Failed to toggle POS connection"),
 variant: "destructive",
 });
 }
 } catch (error) {
 console.error('Error toggling POS:', error);
 toast({
 title: tc("خطأ", "Error"),
 description: tc("فشل الاتصال بالخادم", "Failed to connect to server"),
 variant: "destructive",
 });
 } finally {
 setIsTogglingPos(false);
 }
 };

 const handleSubmitOrder = async () => {
   if (orderItems.length === 0) {
     toast({
       title: tc("خطأ", "Error"),
       description: tc("يرجى إضافة عناصر للطلب", "Please add items to the order"),
       variant: "destructive",
     });
     return;
   }

   // Capture all values BEFORE mutateAsync (form is reset in onSuccess)
   const capturedItems = [...orderItems];
   const capturedCustomerName = customerName;
   const capturedCustomerPhone = customerPhone;
   const capturedPaymentMethod = paymentMethod;
   const capturedTableNumber = tableNumber;
   const capturedOrderType = orderType;
   const capturedDiscount = appliedDiscount;
   const capturedSubtotal = calculateSubtotal().toFixed(2);
   const capturedDiscountAmount = appliedDiscount ? calculateDiscount().toFixed(2) : undefined;
   const capturedEmployeeName = employee?.fullName || "";

   const totalAmount = calculateTotal();
   const orderData = {
     customerId: customerId || undefined,
     customerInfo: {
       customerName: customerName,
       phoneNumber: customerPhone,
       customerEmail: customerEmail || undefined
     },
     items: orderItems.map(item => ({
       coffeeItemId: item.coffeeItem.id,
       quantity: item.quantity,
       size: item.customization?.selectedSize || "Default",
       extras: [
         ...(item.customization?.addons?.map((a: any) => a.nameAr) || []),
         ...((item.customization as any)?.selectedItemAddons?.map((a: any) => a.nameAr) || []),
       ],
       totalPrice: ((Number(item.coffeeItem.price) + (item.customization?.totalAddonsPrice || 0) + ((item.customization as any)?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0)) * item.quantity).toFixed(2)
     })),
     totalAmount: parseFloat(totalAmount),
     paymentMethod,
     orderType,
     tableNumber: orderType === 'dine-in' ? tableNumber : undefined,
     branchId: employee?.branchId,
     discountCode: appliedDiscount?.code,
     discountPercentage: appliedDiscount?.percentage || 0,
     pointsRedeemed: (usePointsDiscount && pointsToRedeem > 0) ? pointsToRedeem : 0,
     pointsValue: (usePointsDiscount && pointsToRedeem > 0) ? pointsToSar(pointsToRedeem) : 0,
     bypassPointsVerification: true,
     channel: 'pos',
   };

   try {
     const order = await createOrderMutation.mutateAsync(orderData);
     
     // Handle Printing after success
     if (order) {
       toast({
         title: tc("تم الطلب", "Order placed"),
         description: tc("جاري تحضير الفواتير...", "Preparing invoices..."),
       });
       
       // Update lastOrder state using pre-captured values (form resets in onSuccess)
       const pmLabel = capturedPaymentMethod === "cash" ? tc("نقدي","Cash") :
         capturedPaymentMethod === "qahwa-card" || capturedPaymentMethod === "loyalty-card" ? tc("بطاقة مكان الشيف","مكان الشيف البخاري Card") :
         tc("إلكتروني","Electronic");
       setLastOrder({
         orderNumber: order.orderNumber,
         customerName: capturedCustomerName,
         customerPhone: capturedCustomerPhone,
         items: capturedItems,
         subtotal: capturedSubtotal,
         discount: capturedDiscount ? {
           code: capturedDiscount.code,
           percentage: capturedDiscount.percentage,
           amount: capturedDiscountAmount || "0"
         } : undefined,
         total: order.totalAmount ?? parseFloat(totalAmount),
         paymentMethod: pmLabel,
         employeeName: capturedEmployeeName,
         tableNumber: capturedTableNumber || undefined,
         deliveryType: capturedOrderType,
         date: new Date().toISOString()
       });

       // Build receipt data from captured values
       const receiptTotal = parseFloat(String(order.totalAmount ?? totalAmount)).toFixed(2);
       const receiptData = {
         orderNumber: order.orderNumber,
         customerName: capturedCustomerName,
         customerPhone: capturedCustomerPhone,
         items: capturedItems as any,
         subtotal: capturedSubtotal,
         discount: capturedDiscount ? {
           code: capturedDiscount.code,
           percentage: capturedDiscount.percentage,
           amount: capturedDiscountAmount || "0"
         } : undefined,
         total: receiptTotal,
         paymentMethod: pmLabel,
         employeeName: capturedEmployeeName,
         tableNumber: capturedTableNumber || undefined,
         deliveryType: capturedOrderType,
         date: new Date().toISOString(),
         crNumber: businessConfig?.commercialRegistration,
         vatNumber: businessConfig?.vatNumber,
       };

       // If offline, save receipt data so user can re-print from pending panel
       if (order.offline) {
         updatePendingOrderReceiptData(order.orderNumber, receiptData);
         setPendingOrdersList(getPendingOrders());
       }

       // Auto-print receipts
       try {
         await printAllReceipts(receiptData);
       } catch (e) {
         console.error("Auto-print error:", e);
       }
     }
   } catch (error) {
     console.error("Order submission error:", error);
   }
 };

 if (!employee) {
 return null;
 }

 return (
 <div className="min-h-screen bg-gray-50 p-4 pb-20 sm:pb-4">
 <div className="max-w-7xl mx-auto">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 flex-shrink-0">
 <img src={chefsplaceLogoStaff} alt="مكان الشيف البخاري" className="w-full h-full object-contain rounded-2xl" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
 </div>
 <div>
 <h1 className="text-2xl font-bold text-primary">{tc("نظام الكاشير","Cashier System")}</h1>
 <p className="text-gray-400 text-sm">{tc("الموظف:","Employee:")} {employee.fullName}</p>
 </div>
 </div>
 <div className="flex items-center gap-3 flex-wrap">
 {pendingOrdersCount > 0 && (
   <button
     onClick={() => { setPendingOrdersList(getPendingOrders()); setShowPendingPanel(true); }}
     className="flex items-center gap-2 bg-orange-600/20 border border-orange-500/40 rounded-lg px-3 py-1.5 hover:bg-orange-600/30 transition-colors cursor-pointer"
     data-testid="button-pending-orders"
   >
     <Printer className="w-4 h-4 text-orange-400" />
     <span className="text-xs text-orange-300 font-medium">{tc("طلبات معلقة","Pending Orders")}</span>
     <Badge className="bg-orange-500 text-white border-0 text-[10px] px-1.5 py-0">
       {pendingOrdersCount}
     </Badge>
   </button>
 )}
 {isOffline && (
   <div className="flex items-center gap-2 bg-red-600/20 border border-red-500/30 rounded-lg px-3 py-1.5">
     <WifiOff className="w-4 h-4 text-red-400" />
     <span className="text-xs text-red-300">{tc("غير متصل بالإنترنت", "Offline")}</span>
   </div>
 )}
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/cashier/phone-lookup")}
 className="border-primary/50 text-primary hover:bg-primary hover:text-white"
 data-testid="button-phone-lookup"
 >
 <Search className="w-4 h-4 ml-2" />
 {tc("بحث برقم الهاتف","Search by Phone")}
 </Button>
 <Dialog open={isPosSettingsOpen} onOpenChange={setIsPosSettingsOpen}>
 <DialogTrigger asChild>
 <div className="bg-white border border-gray-200 rounded-lg px-4 py-2 hover-elevate cursor-pointer" data-testid="pos-settings-trigger">
 <div className="flex items-center gap-2">
 <MonitorSmartphone className={`w-4 h-4 ${posConnected ? 'text-green-400' : 'text-gray-400'}`} />
 <span className="text-xs text-gray-400">{tc("جهاز POS:","POS Device:")}</span>
 <Badge variant="outline" className={posConnected ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}>
 {posConnected ? tc("متصل","Connected") : tc("غير متصل","Disconnected")}
 </Badge>
 <Settings className="w-3 h-3 text-gray-500" />
 </div>
 <p className="text-xs text-gray-500 mt-1">{posConnected ? tc("جاهز للدفع الإلكتروني","Ready for payment") : tc("انقر للإعدادات","Click for settings")}</p>
 </div>
 </DialogTrigger>
 <DialogContent className="bg-white border-gray-200 text-gray-900">
 <DialogHeader>
 <DialogTitle className="text-accent flex items-center gap-2">
 <MonitorSmartphone className="w-5 h-5" />
 {tc("إعدادات جهاز نقاط البيع (POS)","POS Device Settings")}
 </DialogTitle>
 </DialogHeader>
 <div className="space-y-6">
 <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
 <div className="flex items-center gap-3">
 {posConnected ? (
 <Wifi className="w-6 h-6 text-green-400" />
 ) : (
 <WifiOff className="w-6 h-6 text-gray-400" />
 )}
 <div>
 <p className="text-gray-200 font-medium">{tc("حالة الاتصال","Connection Status")}</p>
 <p className={`text-sm ${posConnected ? 'text-green-400' : 'text-gray-500'}`}>
 {posConnected ? tc("متصل وجاهز للاستخدام","Connected and ready") : tc("غير متصل","Disconnected")}
 </p>
 </div>
 </div>
 <Switch
 checked={posConnected}
 onCheckedChange={handleTogglePosConnection}
 disabled={isTogglingPos}
 data-testid="switch-pos-connection"
 />
 </div>
 
 <div className="space-y-3 p-4 bg-gray-50/50 rounded-lg">
 <h4 className="text-accent font-medium flex items-center gap-2">
 <Settings className="w-4 h-4" />
 {tc("معلومات الجهاز","Device Info")}
 </h4>
 <div className="grid grid-cols-2 gap-3 text-sm">
 <div>
 <p className="text-gray-500">{tc("نوع الاتصال","Connection Type")}</p>
 <p className="text-gray-300">USB / {tc("شبكة محلية","Local Network")}</p>
 </div>
 <div>
 <p className="text-gray-500">{tc("حالة الجهاز","Device Status")}</p>
 <p className={posConnected ? 'text-green-400' : 'text-yellow-400'}>
 {posConnected ? tc("نشط","Active") : tc("في وضع الاستعداد","Standby")}
 </p>
 </div>
 </div>
 </div>

 <div className="text-xs text-gray-500 p-3 bg-primary/10 rounded-lg border border-gray-200">
 <p className="font-medium text-primary mb-1">{tc("ملاحظة:","Note:")}</p>
 <p>{tc("عند تفعيل جهاز POS، سيتم معالجة الدفعات الإلكترونية تلقائياً عبر الجهاز. تأكد من توصيل الجهاز بشكل صحيح قبل التفعيل.","When POS is enabled, electronic payments will be processed automatically. Ensure the device is connected correctly before activation.")}</p>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 {lastOrder && (
 <>
 <Button
 onClick={handlePrintReceipt}
 className="bg-blue-600 hover:bg-blue-700 shadow-lg"
 data-testid="button-print-receipt"
 >
 <Printer className="w-4 h-4 ml-2" />
 {tc("طباعة الإيصال","Print Receipt")}
 </Button>
 <Button
 onClick={handlePrintTaxInvoice}
 className="bg-purple-600 hover:bg-purple-700 shadow-lg"
 data-testid="button-print-tax-invoice"
 >
 <FileText className="w-4 h-4 ml-2" />
 {tc("فاتورة ضريبية","Tax Invoice")}
 </Button>
 <Button
 onClick={handlePrintAllReceipts}
 className="bg-green-600 hover:bg-green-700 shadow-lg"
 data-testid="button-print-all-receipts"
 >
 <Printer className="w-4 h-4 ml-2" />
 {tc("طباعة 3 إيصالات","Print 3 Receipts")}
 </Button>
 </>
 )}
 <Button
 size="icon"
 variant="outline"
 onClick={handleOpenCashDrawer}
 className="border-primary/50 text-primary hover:bg-primary hover:text-white"
 data-testid="button-open-drawer"
 title={tc("فتح الخزانة", "Open Cash Drawer")}
 >
 <Wallet className="w-5 h-5" />
 </Button>
 <Button
 size="icon"
 variant="outline"
 onClick={() => setIsPrinterSettingsOpen(true)}
 className="border-primary/50 text-primary hover:bg-primary hover:text-white"
 data-testid="button-printer-settings"
 title={tc("إعدادات الطابعة", "Printer Settings")}
 >
 <Printer className="w-5 h-5" />
 </Button>
 <Button
 variant="outline"
 onClick={() => setLocation("/employee/home")}
 className="border-primary/50 text-primary hover:bg-primary hover:text-white"
 data-testid="button-back-dashboard"
 >
 <ArrowRight className="w-4 h-4 ml-2" />
 {tc("العودة", "Back")}
 </Button>
 </div>
 </div>

 {/* Printer Settings Dialog */}
 <Dialog open={isPrinterSettingsOpen} onOpenChange={setIsPrinterSettingsOpen}>
   <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
     <DialogHeader>
       <DialogTitle className="flex items-center gap-2">
         <Printer className="w-5 h-5 text-primary" />
         {tc("إعدادات الطابعة", "Printer Settings")}
       </DialogTitle>
     </DialogHeader>
     <PrinterSettingsPanel />
   </DialogContent>
 </Dialog>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Menu Section */}
 <div className="lg:col-span-2">
 <Card className="bg-white border-gray-200">
 <CardHeader>
 <CardTitle className="text-accent text-right">{tc("القائمة","Menu")}</CardTitle>
 </CardHeader>
 <CardContent>
 {businessConfig?.cashierLayout === 'pos' ? (
   <POSCashierLayout
     items={coffeeItems as any}
     isLoading={isLoading}
     getItemDisplayName={getItemDisplayName as any}
     onAddItem={addToOrder as any}
   />
 ) : businessConfig?.cashierLayout === 'split' ? (
   <SplitCashierLayout
     items={coffeeItems as any}
     isLoading={isLoading}
     getItemDisplayName={getItemDisplayName as any}
     onAddItem={addToOrder as any}
   />
 ) : (
   <ClassicCashierLayout
     items={coffeeItems as any}
     isLoading={isLoading}
     getItemDisplayName={getItemDisplayName as any}
     onAddItem={addToOrder as any}
   />
 )}
 </CardContent>
 </Card>
 </div>

 {/* Order Summary Section */}
 <div className="lg:col-span-1 space-y-4">
 <Card className="bg-white border-gray-200 sticky top-4">
 <CardHeader>
 <CardTitle className="text-accent text-right flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <ShoppingBag className="w-5 h-5" />
 {tc("الطلب الحالي","Current Order")}
 </div>
 <Badge 
   data-testid="badge-order-type"
   className={
     orderType === 'dine-in' 
       ? 'bg-purple-600 text-white' 
       : orderType === 'pickup' 
         ? 'bg-blue-600 text-white' 
         : 'bg-green-600 text-white'
   }
 >
   {orderType === 'dine-in' ? (
     <><Store className="w-3 h-3 ml-1" />{tc("محلي","Dine-in")}</>
   ) : orderType === 'pickup' ? (
     <><MapPin className="w-3 h-3 ml-1" />{tc("استلام","Pickup")}</>
   ) : (
     <><Truck className="w-3 h-3 ml-1" />{tc("توصيل","Delivery")}</>
   )}
 </Badge>
 </CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 {orderItems.length === 0 ? (
 <div className="text-center text-gray-500 py-8">
 {tc("لا توجد عناصر في الطلب","No items in order")}
 </div>
 ) : (
 <>
 <div className="space-y-3 max-h-64 overflow-y-auto">
 {orderItems.map((item) => (
 <div key={item.coffeeItem.id} className="bg-gray-50 rounded-lg p-3">
 <div className="flex justify-between items-start mb-2">
 <div className="text-right flex-1">
 <div className="flex items-center gap-2">
 <h4 className="text-accent font-medium text-sm" data-testid={`text-order-item-${item.coffeeItem.id}`}>
 {getItemDisplayName(item.coffeeItem)}
 </h4>
 </div>
 <p className="text-gray-400 text-xs">
 {Number(item.coffeeItem.price).toFixed(2)} {tc("ريال","SAR")}
 </p>
 </div>
 <Button
 size="sm"
 variant="ghost"
 onClick={() => removeFromOrder(item.coffeeItem.id)}
 className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
 data-testid={`button-remove-${item.coffeeItem.id}`}
 >
 <Trash2 className="w-4 h-4" />
 </Button>
 </div>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Button
 size="sm"
 variant="outline"
 onClick={() => updateQuantity(item.coffeeItem.id, item.quantity - 1)}
 className="h-7 w-7 p-0 border-gray-300"
 data-testid={`button-decrease-${item.coffeeItem.id}`}
 >
 <Minus className="w-3 h-3" />
 </Button>
 <span className="text-white font-bold min-w-[30px] text-center" data-testid={`text-quantity-${item.coffeeItem.id}`}>
 {item.quantity}
 </span>
 <Button
 size="sm"
 variant="outline"
 onClick={() => updateQuantity(item.coffeeItem.id, item.quantity + 1)}
 className="h-7 w-7 p-0 border-gray-300"
 data-testid={`button-increase-${item.coffeeItem.id}`}
 >
 <Plus className="w-3 h-3" />
 </Button>
 </div>
 <span className="font-bold text-primary">
 {(() => {
   let price = Number(item.coffeeItem.price) || 0;
   if ((item as any).selectedSize && item.coffeeItem.availableSizes) {
     const sz = (item.coffeeItem.availableSizes as any[]).find((s: any) => s.nameAr === (item as any).selectedSize);
     if (sz) price = Number(sz.price) || price;
   }
   const addonsExtra = ((item.customization as any)?.selectedItemAddons || []).reduce((s: number, a: any) => s + (Number(a.price) || 0), 0);
   return ((price + addonsExtra) * item.quantity).toFixed(2);
 })()} {tc("ريال","SAR")}
 </span>
 </div>
 </div>
 ))}
 </div>

 <Separator className="bg-primary/20" />

 <div className="space-y-3">
 <div className="space-y-2">
 <Label className="text-gray-600 text-right block">
 <User className="w-4 h-4 inline ml-2" />
 {tc("اسم العميل","Customer Name")}
 </Label>
 <Input
 value={customerName}
 onChange={(e) => setCustomerName(e.target.value)}
 placeholder={tc("أدخل اسم العميل","Enter customer name")}
 className="bg-gray-50 border-gray-300 text-gray-900 text-right"
 data-testid="input-customer-name"
 />
 </div>

 <div className="space-y-2">
 <Label className="text-gray-600 text-right block">
 <Phone className="w-4 h-4 inline ml-2" />
 {tc("رقم الجوال (9 أرقام تبدأ بـ 5)","Mobile (9 digits starting with 5)")}
 </Label>
 <div className="flex gap-2">
 <Input
 value={customerPhone}
 onChange={(e) => setCustomerPhone(e.target.value)}
 placeholder="5xxxxxxxx"
 className="bg-gray-50 border-gray-300 text-gray-900 text-right flex-1"
 data-testid="input-customer-phone"
 />
 <Dialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner}>
 <DialogTrigger asChild>
 <Button
 variant="outline"
 size="icon"
 className="border-gray-300 text-primary"
 data-testid="button-scan-loyalty"
 >
 <CreditCard className="w-4 h-4" />
 </Button>
 </DialogTrigger>
 <DialogContent className="bg-gray-50 border-gray-300 text-gray-900 max-w-md">
 <DialogHeader>
 <DialogTitle className="text-right text-primary">{tc("مسح بطاقة الولاء","Scan Loyalty Card")}</DialogTitle>
 </DialogHeader>
 <BarcodeScanner
 showManualInput={true}
 onCustomerFound={(result) => {
 if (result.found && result.card) {
 setCustomerPhone(result.card.phoneNumber.replace(/^966|^0/, ''));
 setCustomerName(result.card.customerName || result.customer?.name || '');
 setLoyaltyCard(result.card as any);
 if (result.customer?.id) {
 setCustomerId(result.customer.id);
 setCustomerPoints(result.customer.points || 0);
 }
 setShowBarcodeScanner(false);
 toast({
 title: tc("تم العثور على العميل", "Customer found"),
 description: `${result.card.customerName || tc('عميل','Customer')} - ${result.card.phoneNumber}`,
 });
 }
 }}
 onClose={() => setShowBarcodeScanner(false)}
 />
 </DialogContent>
 </Dialog>
 </div>
 {isCheckingCustomer && (
 <p className="text-xs text-primary text-right animate-pulse">{tc("جاري التحقق من العميل...","Checking customer...")}</p>
 )}
 </div>

 {showRegisterDialog && customerPhone.length === 9 && (
 <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-3">
 <p className="text-blue-300 text-sm text-right">{tc("عميل غير مسجل - يمكنك تسجيله الآن","Unregistered customer — you can register them now")}</p>
 <div className="space-y-2">
 <Label className="text-gray-600 text-right block text-xs">
 {tc("البريد الإلكتروني (اختياري)", "Email (optional)")}
 </Label>
 <Input
 value={customerEmail}
 onChange={(e) => setCustomerEmail(e.target.value)}
 placeholder="customer@example.com"
 type="email"
 className="bg-gray-50 border-blue-500/30 text-gray-900 text-right"
 data-testid="input-customer-email"
 />
 </div>
 <Button
 onClick={handleRegisterCustomer}
 disabled={isRegisteringCustomer || !customerName.trim()}
 className="w-full bg-blue-600 hover:bg-blue-700 text-white"
 data-testid="button-register-customer"
 >
 {isRegisteringCustomer ? tc("جاري التسجيل...", "Registering...") : tc("تسجيل العميل", "Register Customer")}
 </Button>
 <p className="text-xs text-gray-500 text-right">
 {tc("سيتمكن العميل من تفعيل حسابه لاحقاً", "Customer can activate their account later")}
 </p>
 </div>
 )}

 {customerId && customerPoints > 0 && (
 <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 p-4 rounded-lg border border-purple-500/30 space-y-3">
 <div className="flex items-center justify-between">
 <Badge variant="outline" className="border-purple-400 text-purple-300">
 {customerPoints} {tc("نقطة", "pts")}
 </Badge>
 <div className="text-right">
   <span className="text-purple-300 text-sm block">{tc("نقاط العميل", "Customer Points")}</span>
   <span className="text-purple-400 text-xs">≈ {pointsToSar(customerPoints).toFixed(2)} {tc("ريال","SAR")}</span>
 </div>
 </div>
 {!usePointsDiscount ? (
   <div className="space-y-2">
     <div className="flex gap-2 items-center">
       <Input
         type="number"
         min="0"
         max={customerPoints}
         value={pointsToRedeem || ''}
         onChange={(e) => setPointsToRedeem(Math.min(parseInt(e.target.value) || 0, customerPoints))}
         placeholder={tc("عدد النقاط", "Points to use")}
         className="bg-gray-50 border-purple-500/30 text-gray-900 text-center flex-1"
         data-testid="input-points-to-redeem"
       />
       <Button
         size="sm"
         onClick={() => { if (pointsToRedeem > 0) setUsePointsDiscount(true); }}
         disabled={pointsToRedeem <= 0}
         className="bg-purple-600 hover:bg-purple-700 text-white"
         data-testid="button-apply-points-discount"
       >
         <Wallet className="w-4 h-4 ml-1" />
         {tc("تطبيق", "Apply")}
       </Button>
     </div>
     {pointsToRedeem > 0 && (
       <p className="text-xs text-purple-400 text-right">
         {tc("خصم", "Discount")}: {pointsToSar(pointsToRedeem).toFixed(2)} {tc("ريال","SAR")}
       </p>
     )}
   </div>
 ) : (
   <div className="bg-purple-900/30 border border-purple-500/50 rounded p-2 flex items-center justify-between">
     <Button
       size="sm"
       variant="ghost"
       onClick={() => { setUsePointsDiscount(false); setPointsToRedeem(0); }}
       className="text-red-400 hover:text-red-300 text-xs"
       data-testid="button-cancel-points-discount"
     >
       {tc("إلغاء", "Cancel")}
     </Button>
     <div className="text-right">
       <p className="text-purple-300 text-sm font-medium">{tc("تم تطبيق","Applied")} {pointsToRedeem} {tc("نقطة","pts")}</p>
       <p className="text-green-400 text-xs">{tc("خصم","Discount")} {pointsToSar(pointsToRedeem).toFixed(2)} {tc("ريال","SAR")}</p>
     </div>
   </div>
 )}
 </div>
 )}

 {customerId && customerEmail && (
 <div className="text-xs text-gray-500 text-right">
 {customerEmail}
 </div>
 )}

 {loyaltyCard && (
 <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-lg border-2 border-gray-300 space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <Gift className="w-5 h-5 text-primary" />
 <span className="text-accent font-semibold">{tc("بطاقة مكان الشيف","Loyalty Card")}</span>
 </div>
 <Badge className="bg-primary text-black">
 {(loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)} {tc("أختام","stamps")}
 </Badge>
 </div>
 <div className="flex items-center gap-1 justify-end">
 {Array.from({ length: 10 }).map((_, i) => {
 const isEarned = i < (loyaltyCard.freeCupsEarned || 0);
 const isUsed = i < (loyaltyCard.freeCupsRedeemed || 0);
 return (
 <div
 key={i}
 className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
 isUsed
 ? 'bg-gray-600 border-gray-500 text-gray-500 line-through'
 : isEarned
 ? 'bg-primary border-primary text-black'
 : 'bg-gray-800 border-gray-600 text-gray-500'
 }`}
 >
 {isUsed ? 'X' : isEarned ? '•' : i + 1}
 </div>
 );
 })}
 </div>
 <p className="text-xs text-gray-500 text-right flex items-center gap-1 justify-end">
 <Gift className="w-3 h-3 text-primary" />
 {tc("الأطباق المجانية متاحة:","Free drinks available:")} {Math.floor(((loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)) / 10)}
 </p>
 </div>
 )}

 <div className="space-y-2">
 <Label className="text-gray-600 text-right block text-sm font-medium">
 {tc("نوع الطلب","Order Type")}
 </Label>
 <div className="grid grid-cols-3 gap-2">
 <Button
 type="button"
 variant="outline"
 onClick={() => setOrderType('dine-in')}
 className={`flex flex-col items-center gap-1 py-3 ${
 orderType === 'dine-in' 
 ? 'bg-purple-600 border-purple-500 text-white' 
 : 'bg-gray-50 border-gray-300 text-gray-300'
 }`}
 data-testid="button-order-type-dinein"
 >
 <Store className="w-5 h-5" />
 <span className="text-xs">{tc("في المطعم","Dine-in")}</span>
 </Button>
 <Button
 type="button"
 variant="outline"
 onClick={() => setOrderType('pickup')}
 className={`flex flex-col items-center gap-1 py-3 ${
 orderType === 'pickup' 
 ? 'bg-blue-600 border-blue-500 text-white' 
 : 'bg-gray-50 border-gray-300 text-gray-300'
 }`}
 data-testid="button-order-type-pickup"
 >
 <MapPin className="w-5 h-5" />
 <span className="text-xs">{tc("استلام","Pickup")}</span>
 </Button>
 <Button
 type="button"
 variant="outline"
 onClick={() => setOrderType('delivery')}
 className={`flex flex-col items-center gap-1 py-3 ${
 orderType === 'delivery' 
 ? 'bg-green-600 border-green-500 text-white' 
 : 'bg-gray-50 border-gray-300 text-gray-300'
 }`}
 data-testid="button-order-type-delivery"
 >
 <Truck className="w-5 h-5" />
 <span className="text-xs">{tc("توصيل","Delivery")}</span>
 </Button>
 </div>
 </div>

 <div className="space-y-2">
 <Label className="text-gray-600 text-right block">
 <Coffee className="w-4 h-4 inline ml-2" />
 {tc("رقم الطاولة (اختياري)","Table Number (optional)")}
 </Label>
 <Input
 value={tableNumber}
 onChange={(e) => setTableNumber(e.target.value)}
 placeholder={tc("مثال: 5 أو A3","e.g. 5 or A3")}
 className="bg-gray-50 border-gray-300 text-gray-900 text-right"
 data-testid="input-table-number"
 />
 </div>

 <div className="space-y-2">
 <Label className="text-gray-600 text-right block">
 {tc("طريقة الدفع","Payment Method")}
 </Label>
 <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
 <SelectTrigger className="bg-gray-50 border-gray-300 text-gray-900" data-testid="select-payment-method">
 <SelectValue />
 </SelectTrigger>
    <SelectContent className="bg-gray-50 border-gray-300 text-gray-900">
      <SelectItem value="cash">{tc("نقدي","Cash")}</SelectItem>
      <SelectItem value="pos-network">{tc("شبكة","Network")}</SelectItem>
      <SelectItem value="qahwa-card">{tc("بطاقة مكان الشيف (ولاء)","مكان الشيف البخاري Card (Loyalty)")}</SelectItem>
    </SelectContent>
 </Select>
 {paymentMethod === 'qahwa-card' && loyaltyCard && (
 <div className="bg-primary/30 border border-primary/50 rounded-lg p-4 space-y-3 mt-2">
 <div className="space-y-2">
 <Label className="text-accent text-sm">{tc("عدد الأختام المراد استخدامها","Number of stamps to use")}</Label>
 <div className="flex gap-2 items-center">
 <Input
 type="number"
 min="0"
 max={(loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)}
 value={stampsToUse}
 onChange={(e) => setStampsToUse(Math.min(parseInt(e.target.value) || 0, (loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)))}
 className="bg-gray-50 border-gray-300 text-gray-900 text-center w-20"
 data-testid="input-stamps-to-use"
 />
 <span className="text-accent text-sm">{tc("من","of")} {(loyaltyCard.freeCupsEarned || 0) - (loyaltyCard.freeCupsRedeemed || 0)}</span>
 </div>
 </div>
 <div className="bg-gray-50 rounded p-2 space-y-1">
 <p className="text-xs text-gray-400">{tc("تفاصيل الحسم:","Discount details:")}</p>
 <p className="text-accent text-sm">
 {tc("الأختام المستخدمة:","Stamps used:")} {stampsToUse} {tc("ختم","stamp")}
 </p>
 <p className="text-accent text-sm">
 {(() => {
 const itemPrices = orderItems.flatMap(item => 
 Array(item.quantity).fill(item.coffeeItem.price)
 ).sort((a, b) => b - a);
 
 let discount = 0;
 const freeItems = [];
 for (let i = 0; i < Math.min(stampsToUse, itemPrices.length); i++) {
 discount += itemPrices[i];
 freeItems.push(itemPrices[i]);
 }
 return `${tc("قيمة الخصم:","Discount value:")} ${discount.toFixed(2)} SAR (${stampsToUse} ${tc("ختم","stamp")} = ${freeItems.length} ${tc("عنصر مجاني","free item")})`;
 })()}
 </p>
 <p className="text-accent text-sm">
 {(() => {
 const itemPrices = orderItems.flatMap(item => 
 Array(item.quantity).fill(item.coffeeItem.price)
 ).sort((a, b) => b - a);
 
 let discount = 0;
 for (let i = 0; i < Math.min(stampsToUse, itemPrices.length); i++) {
 discount += itemPrices[i];
 }
 const finalPrice = Math.max(0, parseFloat(calculateTotal()) - discount);
 return `${tc("السعر النهائي:","Final price:")} ${finalPrice.toFixed(2)} SAR`;
 })()}
 </p>
 </div>
 </div>
 )}
 </div>

 <div className="space-y-2 bg-gradient-to-br from-green-900/20 to-emerald-900/20 p-4 rounded-lg border border-green-500/20">
 <Label className="text-gray-600 text-right block flex items-center justify-end gap-2">
 <span className="text-green-400">{tc("كود الخصم (اختياري)","Discount Code (optional)")}</span>
 <Gift className="w-5 h-5 text-green-400" />
 </Label>
 <p className="text-xs text-gray-500 text-right mb-2">
 {tc("هل لديك كود خصم؟ أدخله هنا للحصول على تخفيض فوري","Have a discount code? Enter it here for an instant discount")}
 </p>
 {!appliedDiscount ? (
 <div className="flex gap-2">
 <Input
 value={discountCode}
 onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
 placeholder={tc("مثال: WELCOME10", "e.g. WELCOME10")}
 className="bg-gray-50 border-green-500/30 text-gray-900 text-right flex-1 focus:border-green-500"
 data-testid="input-discount-code"
 />
 <Button
 onClick={validateDiscountCode}
 disabled={isValidatingDiscount || !discountCode.trim()}
 className="bg-green-600 hover:bg-green-700 min-w-[100px]"
 data-testid="button-apply-discount"
 >
 {isValidatingDiscount ? (
 <>
 <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2"></div>
 {tc("جاري التحقق","Checking")}
 </>
 ) : (
 <>
 <Check className="w-4 h-4 ml-2" />
 {tc("تطبيق","Apply")}
 </>
 )}
 </Button>
 </div>
 ) : (
 <div className="bg-green-500/20 border-2 border-green-500/50 rounded-lg p-4 animate-pulse-slow">
 <div className="flex items-center justify-between">
 <div className="text-right flex-1">
 <div className="flex items-center gap-2 justify-end mb-1">
 <p className="text-green-400 font-bold text-lg" data-testid="text-applied-discount-code">{appliedDiscount.code}</p>
 <Check className="w-5 h-5 text-green-400" />
 </div>
 <p className="text-sm text-green-300">{appliedDiscount.reason}</p>
 </div>
 <div className="flex items-center gap-2 mr-4">
 <Badge className="bg-green-600 text-white text-base px-3 py-1">-{appliedDiscount.percentage}%</Badge>
 <Button
 size="sm"
 variant="ghost"
 onClick={removeDiscount}
 className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
 data-testid="button-remove-discount"
 >
 <X className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 <Separator className="bg-primary/20" />

 <div className="space-y-2">
 <div className="flex justify-between items-center text-sm">
 <span className="text-gray-400">{tc("المجموع الفرعي:","Subtotal:")}</span>
 <span className="text-gray-300" data-testid="text-subtotal">
 {calculateSubtotal().toFixed(2)} {tc("ريال","SAR")}
 </span>
 </div>
 
 {appliedDiscount && (
 <div className="flex justify-between items-center text-sm">
 <span className="text-green-400">{tc("الخصم","Discount")} ({appliedDiscount.percentage}%):</span>
 <span className="text-green-400" data-testid="text-discount-amount">
 -{calculateDiscount().toFixed(2)} {tc("ريال","SAR")}
 </span>
 </div>
 )}

 {usePointsDiscount && pointsToRedeem > 0 && (
 <div className="flex justify-between items-center text-sm">
 <span className="text-purple-400">{tc("خصم النقاط","Points Discount")} ({pointsToRedeem} {tc("نقطة","pts")}):</span>
 <span className="text-purple-400" data-testid="text-points-discount-amount">
 -{pointsToSar(pointsToRedeem).toFixed(2)} {tc("ريال","SAR")}
 </span>
 </div>
 )}

 <Separator className="bg-primary/10" />
 
 <div className="flex justify-between items-center text-lg font-bold">
 <span className="text-accent">{tc("الإجمالي:","Total:")}</span>
 <span className="text-accent" data-testid="text-total">
 {calculateTotal()} {tc("ريال","SAR")}
 </span>
 </div>
 </div>

 <Button
 onClick={handleSubmitOrder}
 disabled={createOrderMutation.isPending}
 className="w-full bg-gradient-to-r from-green-600 to-green-800 hover:from-green-700 hover:to-green-900 text-white font-bold py-6"
 data-testid="button-submit-order"
 >
 <Check className="w-5 h-5 ml-2" />
 {createOrderMutation.isPending ? tc("جاري الإنشاء...","Creating...") : tc("إنشاء الطلب وإرسال واتساب","Create Order & Send WhatsApp")}
 </Button>
 </>
 )}
 </CardContent>
 </Card>
 </div>
 </div>
 </div>


 {/* Pending Orders Panel */}
 <Dialog open={showPendingPanel} onOpenChange={setShowPendingPanel}>
   <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-gray-50 border-orange-500/30" dir="rtl">
     <DialogHeader>
       <DialogTitle className="text-orange-300 flex items-center gap-2">
         <Printer className="w-5 h-5" />
         {tc('الطلبات المعلقة', 'Pending Orders')}
         <Badge className="bg-orange-500 text-white border-0 mr-2">{pendingOrdersList.filter(o => !o.synced).length}</Badge>
       </DialogTitle>
     </DialogHeader>
     <div className="space-y-3 mt-2">
       {pendingOrdersList.filter(o => !o.synced).length === 0 ? (
         <p className="text-gray-400 text-center py-6">{tc('لا توجد طلبات معلقة', 'No pending orders')}</p>
       ) : (
         pendingOrdersList.filter(o => !o.synced).map((po) => {
           const rd = po.receiptData || po.payload;
           const customerName = rd?.customerName || rd?.customerInfo?.customerName || tc('عميل','Customer');
           const total = rd?.total || rd?.totalAmount || '—';
           const itemCount = (rd?.items || []).length;
           const createdAt = new Date(po.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
           return (
             <div key={po.id} className="bg-white border border-orange-500/20 rounded-xl p-4">
               <div className="flex items-start justify-between gap-3">
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-white font-semibold text-sm">{customerName}</span>
                     <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 border text-[10px] px-1.5">{tc('غير مرسل','Unsynced')}</Badge>
                   </div>
                   <p className="text-gray-400 text-xs">{tc('الوقت:','Time:')} {createdAt} • {itemCount} {tc('منتجات','items')} • {tc('الإجمالي:','Total:')} {total} {tc('ر.س','SAR')}</p>
                   <p className="text-gray-500 text-xs mt-0.5">{tc('رقم:','No:')} {po.id.slice(-8)}</p>
                 </div>
                 <div className="flex flex-col gap-2">
                   {po.receiptData ? (
                     <Button
                       size="sm"
                       className="bg-primary hover:bg-primary/80 text-white text-xs px-3 py-1.5 h-auto"
                       onClick={async () => {
                         try {
                           await printAllReceipts(po.receiptData);
                           toast({ title: tc('جاري الطباعة...','Printing...'), className: 'bg-green-700 text-white' });
                         } catch(e) {
                           toast({ title: tc('خطأ في الطباعة','Print Error'), variant: 'destructive' });
                         }
                       }}
                     >
                       <Printer className="w-3 h-3 ml-1" />
                       {tc('طباعة','Print')}
                     </Button>
                   ) : (
                     <span className="text-gray-500 text-xs">{tc('لا يوجد بيانات طباعة','No print data')}</span>
                   )}
                 </div>
               </div>
             </div>
           );
         })
       )}
     </div>
     <div className="mt-4 pt-3 border-t border-orange-500/20">
       <p className="text-xs text-gray-500 text-center">
         {tc('الطلبات المعلقة ستُرسل تلقائياً عند استعادة الاتصال','Pending orders will sync when internet is restored')}
       </p>
     </div>
   </DialogContent>
 </Dialog>

 <MobileBottomNav employeeRole={employee?.role} />
 </div>
 );
}
