import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import BranchLocationPicker from "@/components/branch-location-picker";
import CouponManagement from "@/components/coupon-management";
import { DeliveryManagement } from "@/components/delivery-management";
import { ManagerSidebar, MobileBottomNav } from "@/components/manager-sidebar";
import { 
 Coffee, Users, ShoppingBag, TrendingUp, DollarSign, 
 Package, MapPin, Layers, ArrowLeft, Calendar, Warehouse,
 UserCheck, Receipt, BarChart3, Download, TrendingDown, Activity, Plus, Trash2, ExternalLink, Edit2, Search,
 Gift, Star, Banknote, Menu, Zap, Clock, Target, ChevronUp, ChevronDown, LogOut
} from "lucide-react";
import * as XLSX from 'xlsx';
import { 
 AreaChart, Area, BarChart as RechartsBar, Bar, 
 PieChart, Pie, Cell, LineChart, Line,
 XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
 ResponsiveContainer 
} from "recharts";
import type { Employee, Order, Customer } from "@shared/schema";
import SarIcon from "@/components/sar-icon";
import { DemoDataManager } from "@/components/demo-data-manager";
import { FlaskConical, Sparkles, Brain, Globe, Plug, Gauge, Code2 } from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";

interface EmployeeWithStats extends Employee {
 orderCount?: number;
 totalSales?: number;
}

const SAUDI_CITIES = [
 { name: 'الرياض | Riyadh', lat: '24.7136', lon: '46.6753' },
 { name: 'جدة | Jeddah', lat: '21.5433', lon: '39.1728' },
 { name: 'الدمام | Dammam', lat: '26.4124', lon: '50.1971' },
 { name: 'مكة المكرمة | Mecca', lat: '21.4225', lon: '39.8262' },
 { name: 'المدينة المنورة | Medina', lat: '24.4672', lon: '39.6024' },
 { name: 'الخبر | Khobar', lat: '26.1588', lon: '50.2046' },
 { name: 'الظهران | Dhahran', lat: '26.1428', lon: '50.1436' },
 { name: 'عرعر | Arar', lat: '30.9753', lon: '41.0272' },
 { name: 'طريف | Turaif', lat: '31.6778', lon: '39.6444' },
 { name: 'القصيم | Qassim', lat: '26.1669', lon: '44.0056' },
 { name: 'حائل | Hail', lat: '27.5247', lon: '41.7202' },
 { name: 'الجوف | Al Jouf', lat: '29.7833', lon: '40.8333' },
 { name: 'الباحة | Al Bahah', lat: '19.9885', lon: '41.4359' },
 { name: 'عسير | Asir', lat: '18.2147', lon: '42.5053' },
 { name: 'الطائف | Taif', lat: '21.2704', lon: '40.4156' },
 { name: 'ينبع | Yanbu', lat: '24.0887', lon: '38.0697' },
 { name: 'الليث | Lith', lat: '20.2381', lon: '40.1797' },
 { name: 'رفحاء | Rafha', lat: '29.6000', lon: '43.4833' },
 { name: 'سكاكا | Sakaka', lat: '29.9709', lon: '40.2056' },
 { name: 'بريدة | Buraydah', lat: '26.3263', lon: '43.9750' },
];

type DateFilterType = "today" | "yesterday" | "week" | "thisMonth" | "lastMonth" | "thisYear" | "all" | "custom";

// Saudi time helper: returns Date at start/end of today in UTC+3
function saudiStartOfDay(d?: Date): Date {
  const target = d ? new Date(d) : new Date();
  // UTC offset for Saudi Arabia is +3 hours
  const utcMs = target.getTime() + (target.getTimezoneOffset() * 60000); // to UTC
  const saudiMs = utcMs + (3 * 3600000); // to Saudi
  const saudi = new Date(saudiMs);
  saudi.setHours(0, 0, 0, 0);
  return new Date(saudi.getTime() - (3 * 3600000) + (-target.getTimezoneOffset() * 60000));
}

export default function ManagerDashboard() {
 const [, setLocation] = useLocation();
 const [manager, setManager] = useState<Employee | null>(null);
 const [dateFilter, setDateFilter] = useState<DateFilterType>("thisMonth");
 const [customStart, setCustomStart] = useState<string>("");
 const [customEnd, setCustomEnd] = useState<string>("");
 const [showCustomRange, setShowCustomRange] = useState(false);
 const tc = useTranslate();

 // Set SEO metadata
 useEffect(() => {
   document.title = "لوحة تحكم المدير - مكان الشيف البخاري | إدارة المبيعات والعمليات";
   const metaDesc = document.querySelector('meta[name="description"]');
   if (metaDesc) metaDesc.setAttribute('content', 'لوحة تحكم المدير في مكان الشيف البخاري - إدارة شاملة للمبيعات والموظفين والفروع والمخزون');
 }, []);
 const [isAddBranchOpen, setIsAddBranchOpen] = useState(false);
 const [isEditBranchOpen, setIsEditBranchOpen] = useState(false);
 const [editingBranch, setEditingBranch] = useState<any>(null);
 const [branchForm, setBranchForm] = useState({
 nameAr: "",
 nameEn: "",
 address: "",
 phone: "",
 city: "",
 managerName: "",
 mapsUrl: "",
 latitude: 24.0887,
 longitude: 38.0697,
 });
 const [branchSearchQuery, setBranchSearchQuery] = useState<string>("");
 const [branchSearchResults, setBranchSearchResults] = useState<Array<{ name: string; lat: string; lon: string }>>([]);
 const [showBranchResults, setShowBranchResults] = useState(false);
 const [isSearchingBranch, setIsSearchingBranch] = useState(false);
 const [demoManagerOpen, setDemoManagerOpen] = useState(false);
 const [managerAssignmentType, setManagerAssignmentType] = useState<"existing" | "new">("existing");
 const [selectedManagerId, setSelectedManagerId] = useState<string>("");
 const [newManagerForm, setNewManagerForm] = useState({
 fullName: "",
 username: "",
 phone: "",
 });
 const { toast } = useToast();
 const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
 const [ordersDisplayLimit, setOrdersDisplayLimit] = useState(20);
 const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

 const deleteOrdersMutation = useMutation({
   mutationFn: async (ids: string[]) => {
     return apiRequest("DELETE", "/api/orders/bulk", { ids });
   },
   onSuccess: (_, ids) => {
     queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
     setSelectedOrderIds(new Set());
     toast({ title: tc(`تم حذف ${ids.length} طلب بنجاح`, `Deleted ${ids.length} orders successfully`), variant: "default" });
   },
   onError: () => {
     toast({ title: tc("خطأ في حذف الطلبات", "Error deleting orders"), variant: "destructive" });
   },
 });

 const handleBulkDelete = () => {
   const ids = Array.from(selectedOrderIds);
   if (ids.length === 0) return;
   if (!window.confirm(tc(`هل تريد حذف ${ids.length} طلب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`, `Delete ${ids.length} orders permanently? This cannot be undone.`))) return;
   deleteOrdersMutation.mutate(ids);
 };

 useEffect(() => {
 const checkSession = async () => {
 const storedEmployee = localStorage.getItem("currentEmployee");
 if (storedEmployee) {
 const emp = JSON.parse(storedEmployee);
 const managerRoles = ["manager", "admin", "owner", "branch_manager"];
 if (!managerRoles.includes(emp.role)) {
 localStorage.removeItem("currentEmployee");
 setLocation("/manager/dashboard");
 return;
 }

 try {
 const response = await fetch("/api/verify-session", { credentials: "include" });
 if (!response.ok) {
 localStorage.removeItem("currentEmployee");
 setLocation("/manager/login");
 return;
 }
 setManager(emp);
 } catch (error) {
 console.error("Session verification error:", error);
 localStorage.removeItem("currentEmployee");
 setLocation("/manager/login");
 }
 } else {
 setLocation("/manager/login");
 }
 };

 checkSession();
 }, [setLocation]);

 const isAdmin = manager?.role === "admin" || manager?.role === "owner";
 const managerBranchId = manager?.branchId;

 const searchBranchLocations = async (query: string) => {
 if (query.length < 1) {
 setBranchSearchResults([]);
 return;
 }
 
 setIsSearchingBranch(true);
 try {
 // First, search through predefined Saudi cities
 const filteredCities = SAUDI_CITIES.filter(city =>
 city.name.includes(query) || 
 city.name.toLowerCase().includes(query.toLowerCase()) ||
 city.name.includes(query.toLowerCase())
 );
 
 if (filteredCities.length > 0) {
 setBranchSearchResults(filteredCities);
 setShowBranchResults(true);
 setIsSearchingBranch(false);
 return;
 }
 
 // If no cities match, try Nominatim for custom locations
 if (query.length >= 2) {
 const response = await fetch(
 `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}, Saudi Arabia&format=json&limit=5&countrycodes=sa`
 );
 const data = await response.json();
 setBranchSearchResults(data || []);
 setShowBranchResults(true);
 } else {
 // Show suggestions when query is too short
 const suggestions = SAUDI_CITIES.slice(0, 5);
 setBranchSearchResults(suggestions);
 setShowBranchResults(true);
 }
 } catch (error) {
 console.error("Error searching branch locations:", error);
 setBranchSearchResults([]);
 } finally {
 setIsSearchingBranch(false);
 }
 };

 const handleBranchSearchChange = (value: string) => {
 setBranchSearchQuery(value);
 setTimeout(() => {
 searchBranchLocations(value);
 }, 500);
 };

 const handleSelectBranchLocation = (location: { name: string; lat: string; lon: string }) => {
 setBranchForm({
 ...branchForm,
 address: location.name,
 latitude: parseFloat(location.lat),
 longitude: parseFloat(location.lon),
 });
 setBranchSearchQuery("");
 setShowBranchResults(false);
 setBranchSearchResults([]);
 };

 const { data: allEmployees = [] } = useQuery<Employee[]>({
 queryKey: ["/api/employees"],
 enabled: !!manager,
 });

 const employees = isAdmin 
   ? allEmployees 
   : allEmployees.filter(emp => emp.branchId === managerBranchId || emp.role === 'manager' || emp.role === 'admin');

 const { data: customers = [] } = useQuery<Customer[]>({
 queryKey: ["/api/customers"],
 enabled: !!manager,
 });

 const { data: allOrders = [] } = useQuery<Order[]>({
 queryKey: ["/api/orders"],
 enabled: !!manager,
 refetchInterval: !!manager ? 15000 : false,
 });

 const orders = isAdmin ? allOrders : allOrders.filter(order => order.branchId === managerBranchId);

 const { data: allBranches = [] } = useQuery<any[]>({
 queryKey: ["/api/branches"],
 enabled: !!manager,
 });

 const branches = isAdmin ? allBranches : allBranches.filter(branch => branch.id === managerBranchId);

 const { data: systemStatus } = useQuery<any>({
   queryKey: ["/api/system/status"],
   enabled: !!manager,
   refetchInterval: 30000,
 });

 const availableManagers = allEmployees.filter(emp => 
 emp.role === "manager" || emp.role === "admin"
 );

 const createBranchMutation = useMutation({
 mutationFn: async (branchData: typeof branchForm & { 
 managerAssignment?: { type: "existing" | "new"; managerId?: string; newManager?: typeof newManagerForm } 
 }) => {
 const payload: any = {
 nameAr: branchData.nameAr,
 nameEn: branchData.nameEn || undefined,
 address: branchData.address,
 phone: branchData.phone,
 city: branchData.city,
 managerName: branchData.managerName || undefined,
 mapsUrl: branchData.mapsUrl || undefined,
 location: {
 lat: branchData.latitude,
 lng: branchData.longitude,
 },
 isActive: 1,
 managerAssignment: branchData.managerAssignment,
 };

 const response = await fetch("/api/branches", {
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 },
 body: JSON.stringify(payload),
 credentials: "include",
 });
 if (!response.ok) {
 const error = await response.json();
 throw new Error(error.error || "Failed to create branch");
 }
 return response.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
 queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
 setIsAddBranchOpen(false);
 setBranchForm({
 nameAr: "",
 nameEn: "",
 address: "",
 phone: "",
 city: "",
 managerName: "",
 mapsUrl: "",
 latitude: 24.0887,
 longitude: 38.0697,
 });
 setManagerAssignmentType("existing");
 setSelectedManagerId("");
 setNewManagerForm({ fullName: "", username: "", phone: "" });
 toast({
 title: tc("تم إضافة الفرع بنجاح", "Branch added successfully"),
 description: tc("تم إضافة الفرع الجديد إلى النظام", "The new branch has been added to the system"),
 });
 },
 onError: (error: any) => {
 toast({
 title: tc("خطأ في إضافة الفرع", "Error adding branch"),
 description: error.message || tc("حدث خطأ أثناء إضافة الفرع", "An error occurred while adding the branch"),
 variant: "destructive",
 });
 },
 });

 const deleteBranchMutation = useMutation({
 mutationFn: async (branchId: string) => {
 await apiRequest("DELETE", `/api/branches/${branchId}`, {});
 return true;
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
 toast({
 title: tc("تم حذف الفرع بنجاح", "Branch deleted successfully"),
 description: tc("تم إزالة الفرع من النظام", "The branch has been removed from the system"),
 });
 },
 onError: (error: any) => {
 toast({
 title: tc("خطأ في حذف الفرع", "Error deleting branch"),
 description: error.message || tc("حدث خطأ أثناء حذف الفرع", "An error occurred while deleting the branch"),
 variant: "destructive",
 });
 },
 });

 const updateBranchMutation = useMutation({
 mutationFn: async (branchData: { id: string; data: typeof branchForm }) => {
 const payload: any = {
 nameAr: branchData.data.nameAr,
 nameEn: branchData.data.nameEn || undefined,
 address: branchData.data.address,
 phone: branchData.data.phone,
 city: branchData.data.city,
 managerName: branchData.data.managerName || undefined,
 mapsUrl: branchData.data.mapsUrl || undefined,
 location: {
 lat: branchData.data.latitude,
 lng: branchData.data.longitude,
 },
 isActive: 1,
 };

 const response = await fetch(`/api/branches/${branchData.id}`, {
 method: "PUT",
 headers: {
 "Content-Type": "application/json",
 },
 body: JSON.stringify(payload),
 credentials: "include",
 });
 if (!response.ok) {
 try {
 const error = await response.json();
 throw new Error(error.error || "Failed to update branch");
 } catch (parseError) {
 throw new Error("Failed to update branch - Server error");
 }
 }
 return response.json();
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
 setIsEditBranchOpen(false);
 setEditingBranch(null);
 setBranchForm({
 nameAr: "",
 nameEn: "",
 address: "",
 phone: "",
 city: "",
 managerName: "",
 mapsUrl: "",
 latitude: 24.0887,
 longitude: 38.0697,
 });
 toast({
 title: tc("تم تحديث الفرع بنجاح", "Branch updated successfully"),
 description: tc("تم تحديث بيانات الفرع", "Branch data has been updated"),
 });
 },
 onError: (error: any) => {
 toast({
 title: tc("خطأ في تحديث الفرع", "Error updating branch"),
 description: error.message || tc("حدث خطأ أثناء تحديث الفرع", "An error occurred while updating the branch"),
 variant: "destructive",
 });
 },
 });

 const handleLogout = () => {
 localStorage.removeItem("currentEmployee");
 setLocation("/employee/gateway");
 };

 const handleCreateBranch = () => {
 if (!branchForm.nameAr || !branchForm.address || !branchForm.city || !branchForm.phone) {
 toast({
 title: tc("بيانات ناقصة", "Missing data"),
 description: tc("الرجاء إدخال جميع البيانات المطلوبة", "Please enter all required fields"),
 variant: "destructive",
 });
 return;
 }
 
 if (managerAssignmentType === "new" && (!newManagerForm.fullName || !newManagerForm.username || !newManagerForm.phone)) {
 toast({
 title: tc("بيانات المدير ناقصة", "Manager data missing"),
 description: tc("الرجاء إدخال جميع بيانات المدير الجديد", "Please enter all new manager details"),
 variant: "destructive",
 });
 return;
 }
 
 const payload = {
 ...branchForm,
 managerAssignment: managerAssignmentType === "new" 
 ? { type: "new" as const, newManager: newManagerForm }
 : selectedManagerId 
 ? { type: "existing" as const, managerId: selectedManagerId }
 : undefined
 };
 
 createBranchMutation.mutate(payload);
 };

 const handleEditBranch = () => {
 if (!editingBranch) return;
 if (!branchForm.nameAr || !branchForm.address || !branchForm.city || !branchForm.phone) {
 toast({
 title: tc("بيانات ناقصة", "Missing data"),
 description: tc("الرجاء إدخال جميع البيانات المطلوبة", "Please enter all required fields"),
 variant: "destructive",
 });
 return;
 }
 
 updateBranchMutation.mutate({
 id: editingBranch.id,
 data: branchForm
 });
 };

 const openEditDialog = (branch: any) => {
 setEditingBranch(branch);
 setBranchForm({
 nameAr: branch.nameAr || "",
 nameEn: branch.nameEn || "",
 address: branch.address || "",
 phone: branch.phone || "",
 city: branch.city || "",
 managerName: branch.managerName || "",
 mapsUrl: branch.mapsUrl || "",
 latitude: branch.location?.lat || 24.7136,
 longitude: branch.location?.lng || 46.6753,
 });
 setIsEditBranchOpen(true);
 };

 const handleExportData = () => {
 try {
 const ordersData = filteredOrders.map(order => {
 const employee = employees.find(e => e.id === order.employeeId);
 return {
 'رقم الطلب': order.orderNumber,
 'التاريخ ': order.createdAt ? new Date(order.createdAt).toLocaleString('ar-SA') : '',
 'اسم العميل': order.customerInfo?.name || '',
 'رقم الجوال': order.customerInfo?.phone || '',
 'رقم الطاولة ': order.tableNumber || '',
 'الحالة': order.status,
 'طريقة الدفع': order.paymentMethod === 'cash' ? 'نقدي' : order.paymentMethod,
 'الكاشير': employee?.fullName || '',
 'الإجمالي': Number(order.totalAmount).toFixed(2),
 };
 });

 const topItemsExport = topItemsData.map(item => ({
 'المنتج': item.name,
 'عدد المبيعات': item.count,
 'الإيرادات': item.revenue.toFixed(2),
 }));

 const employeesExport = employeesWithStats.map(emp => ({
 'الاسم': emp.fullName,
 'الوظيفة': emp.jobTitle,
 'الدور': emp.role === 'manager' ? 'مدير' : 'كاشير',
 'رقم الجوال': emp.phone,
 'عدد الطلبات': emp.orderCount || 0,
 'إجمالي المبيعات': (emp.totalSales || 0).toFixed(2),
 }));

 const wb = XLSX.utils.book_new();
 
 const wsOrders = XLSX.utils.json_to_sheet(ordersData);
 const wsTopItems = XLSX.utils.json_to_sheet(topItemsExport);
 const wsEmployees = XLSX.utils.json_to_sheet(employeesExport);
 
 XLSX.utils.book_append_sheet(wb, wsOrders, 'الطلبات');
 XLSX.utils.book_append_sheet(wb, wsTopItems, 'أكثر المنتجات مبيعاً');
 XLSX.utils.book_append_sheet(wb, wsEmployees, 'الموظفين');

 const dateStr = new Date().toLocaleDateString('ar-SA').replace(/\//g, '-');
 const fileName = `تقرير-المبيعات-${dateStr}.xlsx`;

 XLSX.writeFile(wb, fileName);

 toast({
 title: tc("تم التصدير بنجاح", "Exported successfully"),
 description: tc("تم تصدير البيانات إلى ملف Excel", "Data has been exported to Excel"),
 });
 } catch (error) {
 toast({
 title: tc("خطأ في التصدير", "Export error"),
 description: tc("حدث خطأ أثناء تصدير البيانات", "An error occurred while exporting data"),
 variant: "destructive",
 });
 }
 };

 const clearAllDataMutation = useMutation({
   mutationFn: async () => {
     const response = await fetch('/api/admin/clear-all-data', {
       method: 'DELETE',
       headers: { 'Content-Type': 'application/json' },
       credentials: 'include',
     });
     if (!response.ok) throw new Error('Failed to clear data');
     return response.json();
   },
   onSuccess: (data) => {
     queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
     queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
     toast({
       title: tc("تم بنجاح", "Done"),
       description: data.message,
       variant: "destructive",
     });
   },
   onError: () => {
     toast({
       title: tc("خطأ", "Error"),
       description: tc("فشل تنظيف البيانات", "Failed to clear data"),
       variant: "destructive",
     });
   },
 });

 if (!manager) {
 return <LoadingState message={tc("جاري التحميل...", "Loading...")} />;
 }

 const getFilteredOrders = () => {
   const now = new Date();
   return orders.filter(order => {
     if (!order.createdAt) return dateFilter === "all";
     const orderDate = new Date(order.createdAt);
     if (isNaN(orderDate.getTime())) return dateFilter === "all";

     switch (dateFilter) {
       case "today": {
         const start = saudiStartOfDay();
         const end = new Date(start.getTime() + 24 * 3600000);
         return orderDate >= start && orderDate < end;
       }
       case "yesterday": {
         const todayStart = saudiStartOfDay();
         const start = new Date(todayStart.getTime() - 24 * 3600000);
         return orderDate >= start && orderDate < todayStart;
       }
       case "week": {
         const start = new Date(now.getTime() - 7 * 24 * 3600000);
         return orderDate >= start;
       }
       case "thisMonth": {
         const y = now.getFullYear(), m = now.getMonth();
         const start = new Date(y, m, 1);
         const end   = new Date(y, m + 1, 1);
         return orderDate >= start && orderDate < end;
       }
       case "lastMonth": {
         const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
         const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
         const start = new Date(y, m, 1);
         const end   = new Date(y, m + 1, 1);
         return orderDate >= start && orderDate < end;
       }
       case "thisYear": {
         const start = new Date(now.getFullYear(), 0, 1);
         return orderDate >= start;
       }
       case "custom": {
         if (!customStart && !customEnd) return true;
         const start = customStart ? new Date(customStart + "T00:00:00") : null;
         const end   = customEnd   ? new Date(customEnd   + "T23:59:59") : null;
         if (start && orderDate < start) return false;
         if (end   && orderDate > end)   return false;
         return true;
       }
       default:
         return true;
     }
   });
 };

 const filteredOrders = getFilteredOrders();
 // Revenue only counts non-cancelled, non-rejected, non-refunded orders
 const EXCLUDED_STATUSES = ["cancelled", "rejected", "refunded"];
 const revenueOrders = filteredOrders.filter(o => !EXCLUDED_STATUSES.includes(o.status || ""));
 const totalRevenue = revenueOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
 const completedOrders = filteredOrders.filter(o => o.status === "completed");
 const completedRevenue = completedOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
 const cancelledOrders = filteredOrders.filter(o => EXCLUDED_STATUSES.includes(o.status || ""));
 
 const todayStart = saudiStartOfDay();
 const todayEnd   = new Date(todayStart.getTime() + 24 * 3600000);
 const todayOrders = orders.filter(o => {
   if (!o.createdAt) return false;
   const d = new Date(o.createdAt);
   return !isNaN(d.getTime()) && d >= todayStart && d < todayEnd;
 });
 const todayRevenue = todayOrders
   .filter(o => !["cancelled","rejected","refunded"].includes(o.status || ""))
   .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

 const employeesWithStats: EmployeeWithStats[] = employees.map(emp => {
 const empId = emp.id?.toString();
 const empOrders = filteredOrders.filter(o => {
 const orderEmpId = o.employeeId?.toString();
 return orderEmpId === empId;
 });
 return {
 ...emp,
 orderCount: empOrders.length,
 totalSales: empOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0),
 } as EmployeeWithStats;
 })
 .sort((a, b) => {
 const roleOrder = { 'admin': 0, 'manager': 1, 'cashier': 2 };
 const aRole = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
 const bRole = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
 if (aRole !== bRole) return aRole - bRole;
 return (b.totalSales || 0) - (a.totalSales || 0);
 });

 const dailyRevenueData = (() => {
 const days: Record<string, number> = {};
 filteredOrders.forEach(order => {
 if (!order.createdAt) return;
 const orderDate = new Date(order.createdAt);
 if (isNaN(orderDate.getTime())) return;
 
 const dateStr = orderDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
 days[dateStr] = (days[dateStr] || 0) + Number(order.totalAmount || 0);
 });
 return Object.entries(days).map(([date, revenue]) => ({
 date,
 revenue: Number(revenue.toFixed(2))
 })).slice(-14);
 })();

 const paymentMethodsData = (() => {
 const methods: Record<string, number> = {};
 filteredOrders.forEach(order => {
 methods[order.paymentMethod] = (methods[order.paymentMethod] || 0) + 1;
 });
 return Object.entries(methods).map(([name, value]) => ({
 name: name === 'cash' ? 'نقدي' : name,
 value
 }));
 })();

 const topItemsData = (() => {
 const items: Record<string, { count: number; revenue: number }> = {};
 filteredOrders.forEach(order => {
 const orderItems = Array.isArray(order.items) ? order.items : [];
 orderItems.forEach((item: any) => {
 const name = item.coffeeItem?.nameAr || item.nameAr || 'مشروب';
 if (!items[name]) {
 items[name] = { count: 0, revenue: 0 };
 }
 items[name].count += item.quantity || 0;
 items[name].revenue += (item.quantity || 0) * Number(item.price || item.coffeeItem?.price || 0);
 });
 });
 return Object.entries(items)
 .map(([name, data]) => ({
 name,
 count: data.count,
 revenue: Number(data.revenue.toFixed(2))
 }))
 .sort((a, b) => b.revenue - a.revenue)
 .slice(0, 10);
 })();

 const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))', 'hsl(var(--secondary))'];
 
 const growthRate = (() => {
   if (dateFilter === "today" || dateFilter === "all" || dateFilter === "custom" || dateFilter === "thisYear") return 0;
   const now = new Date();
   let curStart: Date, curEnd: Date, prevStart: Date, prevEnd: Date;
   if (dateFilter === "week") {
     curEnd   = now;
     curStart = new Date(now.getTime() - 7 * 24 * 3600000);
     prevEnd  = curStart;
     prevStart = new Date(curStart.getTime() - 7 * 24 * 3600000);
   } else if (dateFilter === "yesterday") {
     const ts = saudiStartOfDay();
     curStart = new Date(ts.getTime() - 24 * 3600000);
     curEnd   = ts;
     prevStart = new Date(curStart.getTime() - 24 * 3600000);
     prevEnd   = curStart;
   } else if (dateFilter === "thisMonth") {
     const y = now.getFullYear(), m = now.getMonth();
     curStart = new Date(y, m, 1);
     curEnd   = new Date(y, m + 1, 1);
     prevStart = new Date(y, m - 1, 1);
     prevEnd   = curStart;
   } else if (dateFilter === "lastMonth") {
     const y = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
     const m = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
     curStart = new Date(y, m, 1);
     curEnd   = new Date(y, m + 1, 1);
     prevStart = new Date(y, m - 1, 1);
     prevEnd   = curStart;
   } else {
     return 0;
   }
   const EXCL = ["cancelled","rejected","refunded"];
   const rev = (os: typeof orders) => os.filter(o => !EXCL.includes(o.status||"")).reduce((s,o) => s + Number(o.totalAmount||0), 0);
   const inRange = (start: Date, end: Date) => orders.filter(o => {
     if (!o.createdAt) return false;
     const d = new Date(o.createdAt);
     return !isNaN(d.getTime()) && d >= start && d < end;
   });
   const currentRevenue  = rev(inRange(curStart,  curEnd));
   const previousRevenue = rev(inRange(prevStart!, prevEnd!));
   if (previousRevenue === 0) return currentRevenue > 0 ? 100 : 0;
   return Number((((currentRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1));
 })();

 const hourNow = new Date().getHours();
 const greeting = hourNow < 12 ? tc("صباح الخير", "Good Morning") : hourNow < 17 ? tc("مساء الخير", "Good Afternoon") : tc("مساء النور", "Good Evening");
 const todayLabel = new Date().toLocaleDateString(tc('ar-SA', 'en-US'), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

 return (
 <>
 <div className="flex h-screen overflow-hidden bg-background" style={{ fontFamily: "'Cairo', sans-serif" }}>

   {/* ─── SIDEBAR ─── */}
   <ManagerSidebar
     manager={manager}
     onLogout={handleLogout}
     mobileOpen={mobileMenuOpen}
     onMobileClose={() => setMobileMenuOpen(false)}
     role={manager?.role}
   />

   {/* ─── MAIN CONTENT ─── */}
   <div className="flex-1 flex flex-col overflow-hidden min-w-0">

     {/* TOP HEADER */}
     <header className="flex-shrink-0 bg-background border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between gap-3">
       <div className="flex items-center gap-3">
         <button
           className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:text-foreground"
           onClick={() => setMobileMenuOpen(true)}
         >
           <Menu className="w-5 h-5" />
         </button>
         <div className="hidden sm:block">
           <div className="flex items-center gap-2">
             <div className="text-foreground font-bold text-sm">{greeting}، <span className="text-[#2D9B6E]">{manager.fullName}</span></div>
             <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
               manager.role === 'admin' ? 'bg-purple-500/15 text-purple-400 border-purple-500/30' :
               manager.role === 'owner' ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' :
               manager.role === 'branch_manager' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' :
               'bg-[#2D9B6E]/15 text-[#2D9B6E] border-[#2D9B6E]/30'
             }`}>
               {manager.role === 'admin' ? 'مدير عام' : manager.role === 'owner' ? 'مالك' : manager.role === 'branch_manager' ? 'مدير فرع' : 'مدير'}
             </span>
           </div>
           <div className="text-muted-foreground text-xs">{todayLabel}</div>
         </div>
       </div>
       <div className="flex items-center gap-2">
         {systemStatus && (
           <div data-testid="system-status-badge" className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/25">
             <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
             {tc("النظام يعمل", "Online")}
             {systemStatus.pendingOrders > 0 && (
               <span className="mr-1 px-1.5 rounded-full bg-amber-500/20 text-amber-400 text-[9px]">
                 {systemStatus.pendingOrders} {tc("معلقة", "pending")}
               </span>
             )}
           </div>
         )}
         {/* ── Date filter ── */}
         <div className="flex items-center gap-1.5 flex-wrap justify-end">
           <Select value={dateFilter} onValueChange={(value: DateFilterType) => {
             setDateFilter(value);
             setShowCustomRange(value === "custom");
           }}>
             <SelectTrigger className="h-8 w-36 text-xs bg-muted/50 border-border text-foreground/70" data-testid="select-date-filter">
               <Calendar className="w-3 h-3 ml-1 shrink-0" />
               <SelectValue />
             </SelectTrigger>
             <SelectContent className="bg-card border-border">
               <SelectItem value="today"     className="text-xs">اليوم</SelectItem>
               <SelectItem value="yesterday" className="text-xs">أمس</SelectItem>
               <SelectItem value="week"      className="text-xs">آخر 7 أيام</SelectItem>
               <SelectItem value="thisMonth" className="text-xs">هذا الشهر</SelectItem>
               <SelectItem value="lastMonth" className="text-xs">الشهر الماضي</SelectItem>
               <SelectItem value="thisYear"  className="text-xs">هذا العام</SelectItem>
               <SelectItem value="all"       className="text-xs">كل الفترات</SelectItem>
               <SelectItem value="custom"    className="text-xs">نطاق مخصص …</SelectItem>
             </SelectContent>
           </Select>
           {showCustomRange && (
             <div className="flex items-center gap-1 bg-muted/50 border border-border rounded-lg px-2 py-1">
               <input
                 type="date"
                 value={customStart}
                 onChange={e => setCustomStart(e.target.value)}
                 className="text-[11px] bg-transparent text-foreground outline-none w-28"
                 data-testid="input-custom-start"
               />
               <span className="text-muted-foreground text-[10px] mx-0.5">—</span>
               <input
                 type="date"
                 value={customEnd}
                 onChange={e => setCustomEnd(e.target.value)}
                 className="text-[11px] bg-transparent text-foreground outline-none w-28"
                 data-testid="input-custom-end"
               />
             </div>
           )}
         </div>
         {import.meta.env.DEV && (
           <Button variant="outline" size="sm" onClick={() => setDemoManagerOpen(true)} className="h-8 text-xs border-border bg-muted/50 text-muted-foreground hover:text-foreground hidden sm:flex">
             <FlaskConical className="w-3 h-3 ml-1" />
             تجريبي
           </Button>
         )}
         <Button variant="outline" size="sm" onClick={handleExportData} className="h-8 text-xs border-border bg-muted/50 text-muted-foreground hover:text-foreground">
           <Download className="w-3 h-3 ml-1" />
           Excel
         </Button>
         <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="تسجيل الخروج" data-testid="button-logout">
           <LogOut className="w-4 h-4" />
         </Button>
       </div>
     </header>

     {/* SCROLLABLE CONTENT */}
     <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
       <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">

         {/* ── KPI CARDS (clean white design) ── */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
           {[
             {
               label: 'إجمالي المبيعات',
               value: totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 }),
               sub: <><SarIcon /> <span>ريال سعودي</span>{growthRate !== 0 && (
                 <span className={`mr-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${growthRate > 0 ? 'bg-white/20 text-white' : 'bg-white/20 text-white'}`}>
                   {growthRate > 0 ? '↑' : '↓'} {Math.abs(growthRate)}%
                 </span>
               )}{cancelledOrders.length > 0 && (
                 <span className="mr-1 text-[10px] text-white/60" title="لا تشمل الملغية والمرفوضة">
                   ({cancelledOrders.length} ملغي)
                 </span>
               )}</>,
               icon: DollarSign,
               cardBg: 'bg-emerald-600',
               iconBg: 'bg-white/20',
               iconColor: 'text-white',
             },
             {
               label: 'الطلبات',
               value: filteredOrders.length.toLocaleString('en-US'),
               sub: <><span className="text-white/80">{completedOrders.length} مكتمل</span><span className="text-white/50 mx-1">·</span><span className="text-white/80">{filteredOrders.filter(o => !["completed","cancelled","rejected","refunded"].includes(o.status||"")).length} جاري</span>{cancelledOrders.length > 0 && <><span className="text-white/50 mx-1">·</span><span className="text-white/70">{cancelledOrders.length} ملغي</span></>}</>,
               icon: ShoppingBag,
               cardBg: 'bg-blue-600',
               iconBg: 'bg-white/20',
               iconColor: 'text-white',
             },
             {
               label: 'العملاء',
               value: customers.length.toLocaleString('en-US'),
               sub: <span className="text-white/70">عميل مسجل</span>,
               icon: Users,
               cardBg: 'bg-violet-600',
               iconBg: 'bg-white/20',
               iconColor: 'text-white',
             },
             {
               label: 'متوسط الطلب',
               value: filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(1) : '0',
               sub: <><SarIcon /> <span>ريال / طلب</span></>,
               icon: Target,
               cardBg: 'bg-amber-500',
               iconBg: 'bg-white/20',
               iconColor: 'text-white',
             },
           ].map(k => (
             <div key={k.label} className={`${k.cardBg} rounded-2xl p-4 lg:p-5 hover:shadow-lg hover:brightness-105 transition-all`} data-testid={`kpi-${k.label}`}>
               <div className="flex items-start justify-between mb-3">
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${k.iconBg}`}>
                   <k.icon className={`w-5 h-5 ${k.iconColor}`} />
                 </div>
               </div>
               <div className="text-white/70 text-xs mb-1">{k.label}</div>
               <div className="text-2xl lg:text-3xl font-bold leading-tight text-white">{k.value}</div>
               <div className="text-xs mt-2 flex items-center gap-1 text-white/70 flex-wrap">{k.sub}</div>
             </div>
           ))}
         </div>

         {/* ── TODAY MINI STATS (pill row) ── */}
         <div className="bg-card border border-border rounded-2xl p-1 flex items-stretch divide-x divide-border rtl:divide-x-reverse">
           {[
             { label: 'طلبات اليوم',         value: todayOrders.length.toString(),       color: 'text-emerald-600' },
             { label: 'مبيعات اليوم (ر.س)', value: todayRevenue.toFixed(0),              color: 'text-blue-600'    },
             { label: 'الموظفون',             value: employees.length.toString(),          color: 'text-amber-600'   },
           ].map(s => (
             <div key={s.label} className="flex-1 px-3 py-3 text-center">
               <div className={`font-bold text-xl ${s.color}`}>{s.value}</div>
               <div className="text-muted-foreground text-[11px] mt-0.5">{s.label}</div>
             </div>
           ))}
         </div>

         {/* ── 🧪 المختبر التقني — موحَّد (Phase 5-9) ── */}
         <details className="group bg-card border border-border rounded-2xl mb-3" data-testid="lab-section">
           <summary className="cursor-pointer list-none flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors rounded-2xl">
             <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15 border border-violet-500/20 flex items-center justify-center shrink-0">
               <FlaskConical className="w-5 h-5 text-violet-500" />
             </div>
             <div className="text-right flex-1 min-w-0">
               <div className="text-foreground font-bold text-sm">🧪 {tc("المختبر التقني", "Tech Lab")}</div>
               <div className="text-muted-foreground text-xs mt-0.5">{tc("أدوات المطور · جودة الكود · الأداء · الذكاء الاصطناعي · التكامل · الموثوقية", "Dev Tools · Code Quality · Performance · AI · Integration · Reliability")}</div>
             </div>
             <ChevronDown className="w-4 h-4 text-muted-foreground group-open:rotate-180 transition-transform" />
           </summary>
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-3 pt-0">
             {[
               { id: "code-quality", label: tc("جودة الكود","Code Quality"),   icon: Code2,    path: "/manager/code-quality", cls: "border-violet-500/20 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/40",     iconCls: "text-violet-500"  },
               { id: "performance",  label: tc("الأداء","Performance"),       icon: Gauge,    path: "/manager/performance",  cls: "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/40",         iconCls: "text-amber-500"   },
               { id: "ecosystem",    label: tc("التكامل","Integrations"),     icon: Plug,     path: "/manager/ecosystem",    cls: "border-cyan-500/20 bg-cyan-500/5 hover:bg-cyan-500/10 hover:border-cyan-500/40",             iconCls: "text-cyan-500"    },
               { id: "ai-automation",label: tc("AI أتمتة","AI Automation"),   icon: Brain,    path: "/manager/ai-automation",cls: "border-fuchsia-500/20 bg-fuchsia-500/5 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/40", iconCls: "text-fuchsia-500" },
               { id: "reliability",  label: tc("الموثوقية","Reliability"),    icon: Sparkles, path: "/manager/reliability",  cls: "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40", iconCls: "text-emerald-500" },
             ].map(({ id, label, icon: Icon, path, cls, iconCls }) => (
               <button
                 key={id}
                 onClick={() => setLocation(path)}
                 data-testid={`link-lab-${id}`}
                 className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${cls}`}
               >
                 <Icon className={`w-5 h-5 ${iconCls}`} />
                 <span className="text-[11px] font-medium text-foreground text-center leading-tight">{label}</span>
               </button>
             ))}
           </div>
         </details>

         {/* ── AI BANNER (clean) ── */}
         <button
           onClick={() => setLocation("/manager/ai")}
           className="w-full group bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-violet-300 hover:bg-violet-50/30 transition-all"
           data-testid="link-ai-center"
         >
           <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
             <Brain className="w-6 h-6 text-violet-600" />
           </div>
           <div className="text-right flex-1 min-w-0">
             <div className="flex items-center gap-2 flex-wrap">
               <div className="text-foreground font-bold text-sm">{tc("مركز الذكاء الاصطناعي", "AI Center")}</div>
               <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">{tc("جديد", "New")}</span>
             </div>
             <div className="text-muted-foreground text-xs mt-0.5">{tc("تحليل المبيعات · رؤى ذكية · مساعد محادثة", "Sales Analysis · Smart Insights · Chat Assistant")}</div>
           </div>
           <Sparkles className="w-5 h-5 text-violet-500 group-hover:scale-110 transition-transform" />
         </button>

         {/* ── CHARTS ── */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
           {/* Revenue Chart */}
           <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4">
             <div className="flex items-center justify-between mb-4">
               <div>
                 <div className="text-foreground font-bold text-sm">📈 المبيعات اليومية</div>
                 <div className="text-muted-foreground text-xs">الاتجاه خلال الفترة المحددة</div>
               </div>
               <div className="w-8 h-8 rounded-lg bg-[#2D9B6E]/10 flex items-center justify-center">
                 <TrendingUp className="w-4 h-4 text-[#2D9B6E]" />
               </div>
             </div>
             <div className="h-[220px]">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={dailyRevenueData}>
                   <defs>
                     <linearGradient id="mgRevGrad" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#2D9B6E" stopOpacity={0.3} />
                       <stop offset="95%" stopColor="#2D9B6E" stopOpacity={0} />
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                   <XAxis dataKey="date" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                   <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                   <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: 12 }} />
                   <Area type="monotone" dataKey="revenue" stroke="#2D9B6E" strokeWidth={2} fill="url(#mgRevGrad)" dot={false} />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Payment Methods */}
           <div className="bg-card border border-border rounded-2xl p-4">
             <div className="flex items-center justify-between mb-4">
               <div>
                 <div className="text-foreground font-bold text-sm">💳 طرق الدفع</div>
                 <div className="text-muted-foreground text-xs">توزيع المعاملات</div>
               </div>
             </div>
             <div className="h-[240px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie data={paymentMethodsData} cx="50%" cy="45%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                     {paymentMethodsData.map((_, i) => (
                       <Cell key={i} fill={COLORS[i % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: 11 }} />
                   <Legend
                     layout="vertical"
                     align="center"
                     verticalAlign="bottom"
                     iconType="circle"
                     iconSize={8}
                     wrapperStyle={{ fontSize: 11, color: '#666', paddingTop: 12, lineHeight: '22px' }}
                   />
                 </PieChart>
               </ResponsiveContainer>
             </div>
           </div>
         </div>

         {/* ── TOP ITEMS ── */}
         {topItemsData.length > 0 && (
           <div className="bg-card border border-border rounded-2xl p-4">
             <div className="flex items-center justify-between mb-4">
               <div className="text-foreground font-bold text-sm">الأكثر مبيعاً</div>
               <Button variant="ghost" size="sm" onClick={() => setLocation("/manager/analytics")} className="text-[#2D9B6E] hover:text-[#2D9B6E] text-xs h-7">
                 التفاصيل ←
               </Button>
             </div>
             <div className="h-[180px]">
               <ResponsiveContainer width="100%" height="100%">
                 <RechartsBar data={topItemsData.slice(0, 5)} layout="vertical" barSize={12}>
                   <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                   <XAxis type="number" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                   <YAxis dataKey="name" type="category" tick={{ fill: '#aaa', fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
                   <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: 11 }} />
                   <Bar dataKey="revenue" name={tc("المبيعات","Sales")} radius={[0, 6, 6, 0]}>
                     {topItemsData.slice(0, 5).map((_, i) => (
                       <Cell key={i} fill={COLORS[i % COLORS.length]} />
                     ))}
                   </Bar>
                 </RechartsBar>
               </ResponsiveContainer>
             </div>
           </div>
         )}

         {/* ── QUICK ACTIONS GRID ── */}
         <div className="bg-card border border-border rounded-2xl p-4">
           <div className="text-foreground font-bold text-sm mb-4">⚡ {tc("وصول سريع","Quick Access")}</div>
           <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
             {[
               { label: tc("نقطة البيع","POS"),           icon: "🛒", path: "/employee/pos",               color: "#2D9B6E" },
               { label: tc("الطلبات","Orders"),           icon: "📋", path: "/employee/orders",             color: "#3b82f6" },
               { label: tc("المخزون","Inventory"),        icon: "📦", path: "/manager/inventory",           color: "#f59e0b" },
               { label: tc("المحاسبة","Accounting"),      icon: "💰", path: "/manager/accounting",          color: "#8b5cf6" },
               { label: tc("الموظفون","Employees"),       icon: "👥", path: "/admin/employees",             color: "#ec4899" },
               { label: tc("التوصيل","Delivery"),         icon: "🚚", path: "/manager/delivery",            color: "#06b6d4" },
               { label: tc("الولاء","Loyalty"),           icon: "🎁", path: "/manager/loyalty",             color: "#f43f5e" },
               { label: tc("التقارير","Reports"),         icon: "📊", path: "/manager/unified-reports",     color: "#14b8a6" },
               { label: tc("الرواتب","Payroll"),          icon: "💸", path: "/manager/payroll",             color: "#7c3aed" },
               { label: tc("العروض","Promotions"),        icon: "🏷️", path: "/manager/promotions",          color: "#f97316" },
               { label: tc("الوصفات","Recipes"),          icon: "🧪", path: "/manager/inventory/recipes",   color: "#84cc16" },
               { label: "ZATCA",                          icon: "🧾", path: "/manager/zatca",               color: "#a855f7" },
               { label: tc("الحضور","Attendance"),        icon: "⏰", path: "/manager/attendance",          color: "#e879f9" },
               { label: tc("الكيوسك","Kiosk"),            icon: "🖥️", path: "/kiosk",                      color: "#22c55e" },
               { label: tc("الدعم","Support"),            icon: "🎧", path: "/manager/support",             color: "#64748b" },
               { label: tc("الإعدادات","Settings"),       icon: "⚙️", path: "/admin/settings",             color: "#94a3b8" },
             ].map(item => (
               <button
                 key={item.path}
                 onClick={() => setLocation(item.path)}
                 className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-muted/50 hover:bg-muted border border-border hover:border-border transition-all group"
               >
                 <span className="text-xl group-hover:scale-110 transition-transform">{item.icon}</span>
                 <span className="text-[10px] text-muted-foreground group-hover:text-foreground/70 text-center leading-tight">{item.label}</span>
               </button>
             ))}
           </div>
         </div>

         {/* ── TABS (DETAILED SECTIONS) ── */}
         <div className="bg-card border border-border rounded-2xl overflow-hidden">
         <Tabs defaultValue="orders" className="w-full">
           <div className="border-b border-border overflow-x-auto">
             <TabsList className="h-12 bg-transparent rounded-none px-2 gap-1 flex-nowrap min-w-max">
               <TabsTrigger value="orders" className="data-[state=active]:bg-muted data-[state=active]:text-[#2D9B6E] text-muted-foreground text-xs rounded-lg px-3 h-8">📋 الطلبات</TabsTrigger>
               <TabsTrigger value="employees" className="data-[state=active]:bg-muted data-[state=active]:text-blue-400 text-muted-foreground text-xs rounded-lg px-3 h-8">👥 الموظفون</TabsTrigger>
               <TabsTrigger value="branches" className="data-[state=active]:bg-muted data-[state=active]:text-amber-400 text-muted-foreground text-xs rounded-lg px-3 h-8">🏢 الفروع</TabsTrigger>
               <TabsTrigger value="coupons" className="data-[state=active]:bg-muted data-[state=active]:text-pink-400 text-muted-foreground text-xs rounded-lg px-3 h-8">🎟️ الكوبونات</TabsTrigger>
               <TabsTrigger value="delivery" className="data-[state=active]:bg-muted data-[state=active]:text-cyan-400 text-muted-foreground text-xs rounded-lg px-3 h-8">🚚 التوصيل</TabsTrigger>
               <TabsTrigger value="erp" className="data-[state=active]:bg-muted data-[state=active]:text-purple-400 text-muted-foreground text-xs rounded-lg px-3 h-8">📚 ERP</TabsTrigger>
             </TabsList>
           </div>


 <TabsContent value="orders" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between flex-wrap gap-3">
 <div>
 <CardTitle>{tc("سجل الطلبات", "Orders Log")}</CardTitle>
 <CardDescription>{tc(`آخر ${filteredOrders.length} طلب`, `Last ${filteredOrders.length} orders`)}</CardDescription>
 </div>
 <div className="flex items-center gap-2">
 {selectedOrderIds.size > 0 && (
 <Button
 variant="destructive"
 size="sm"
 onClick={handleBulkDelete}
 disabled={deleteOrdersMutation.isPending}
 data-testid="button-bulk-delete-orders"
 className="gap-2"
 >
 <Trash2 className="w-4 h-4" />
 {tc("حذف المحدد", "Delete selected")} ({selectedOrderIds.size})
 </Button>
 )}
 <Button
 variant="outline"
 size="sm"
 onClick={() => {
 if (selectedOrderIds.size === filteredOrders.length) {
 setSelectedOrderIds(new Set());
 } else {
 setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
 }
 }}
 data-testid="button-select-all-orders"
 className="gap-2"
 >
 <Checkbox
 checked={filteredOrders.length > 0 && selectedOrderIds.size === filteredOrders.length}
 className="pointer-events-none"
 />
 {selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 ? tc('إلغاء الكل', 'Deselect all') : tc('تحديد الكل', 'Select all')}
 </Button>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <div className="space-y-3">
 {filteredOrders.length === 0 ? (
 <EmptyState title={tc("لا يوجد طلبات", "No orders")} description={tc("لم يتم العثور على طلبات في هذه الفترة", "No orders found in this period")} />
 ) : (
 <>
 {filteredOrders.slice(0, ordersDisplayLimit).map((order) => {
 const employee = employees.find(e => e.id === order.employeeId);
 const isSelected = selectedOrderIds.has(order.id);
 return (
 <div
 key={order.id}
 className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl gap-4 transition-colors cursor-pointer ${
 isSelected ? 'border-destructive bg-destructive/5' : 'border-border bg-muted/30 hover:bg-muted/50'
 }`}
 onClick={() => {
 const next = new Set(selectedOrderIds);
 if (next.has(order.id)) next.delete(order.id);
 else next.add(order.id);
 setSelectedOrderIds(next);
 }}
 data-testid={`order-row-${order.id}`}
 >
 <div className="flex items-center gap-3">
 <Checkbox
 checked={isSelected}
 onCheckedChange={() => {
 const next = new Set(selectedOrderIds);
 if (next.has(order.id)) next.delete(order.id);
 else next.add(order.id);
 setSelectedOrderIds(next);
 }}
 onClick={e => e.stopPropagation()}
 data-testid={`checkbox-order-${order.id}`}
 />
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
 <Receipt className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="font-bold text-foreground">{tc("طلب", "Order")} {order.orderNumber}</p>
 <div className="flex items-center gap-2 text-xs text-muted-foreground">
 <span>{order.createdAt ? new Date(order.createdAt).toLocaleString('ar-SA') : ''}</span>
 <span>•</span>
 <span>{order.customerInfo?.name || employee?.fullName || tc('عميل', 'Customer')}</span>
 </div>
 </div>
 </div>
 <div className="flex items-center gap-4 justify-between sm:justify-end" onClick={e => e.stopPropagation()}>
 <div className="text-left sm:text-right">
 <p className="font-bold text-primary">{Number(order.totalAmount).toFixed(2)} <SarIcon /></p>
 <Badge variant={order.status === "completed" ? "default" : "secondary"}>
 {order.status}
 </Badge>
 </div>
 <Button variant="ghost" size="icon" onClick={() => setLocation(`/order-receipt/${order.id}`)}>
 <ExternalLink className="w-4 h-4" />
 </Button>
 </div>
 </div>
 );
 })}
 {filteredOrders.length > ordersDisplayLimit && (
 <Button
 variant="outline"
 className="w-full mt-2"
 onClick={() => setOrdersDisplayLimit(prev => prev + 20)}
 data-testid="button-show-more-orders"
 >
 {tc("عرض المزيد", "Show more")} ({filteredOrders.length - ordersDisplayLimit} {tc("طلب متبقٍ", "remaining")})
 </Button>
 )}
 </>
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>



 <TabsContent value="employees" className="space-y-4">
 <Card>
 <CardHeader>
 <CardTitle>{tc("أداء الموظفين", "Staff Performance")}</CardTitle>
 <CardDescription>{tc("مبيعات الموظفين وعدد الطلبات لكل موظف", "Staff sales and order counts per employee")}</CardDescription>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {employeesWithStats.map((emp) => {
 const empId = emp.id?.toString();
 return (
 <div key={empId} className="p-4 border border-border rounded-xl bg-muted/30">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
 <Users className="w-5 h-5 text-primary" />
 </div>
 <div>
 <p className="font-bold">{emp.fullName}</p>
 <Badge variant="outline" className="text-[10px]">{emp.role === 'admin' ? tc('مدير عام', 'Admin') : emp.role === 'manager' ? tc('مدير', 'Manager') : tc('موظف', 'Staff')}</Badge>
 </div>
 </div>
 <div className="space-y-2">
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">{tc("عدد الطلبات:", "Orders:")}</span>
 <span className="font-bold">{emp.orderCount || 0}</span>
 </div>
 <div className="flex justify-between text-sm">
 <span className="text-muted-foreground">{tc("إجمالي المبيعات:", "Total Sales:")}</span>
 <span className="font-bold text-primary">{(emp.totalSales || 0).toFixed(2)} <SarIcon /></span>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="branches" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex justify-between items-center gap-4 flex-wrap">
 <div>
 <CardTitle className="text-primary">{tc("الفروع", "Branches")}</CardTitle>
 <CardDescription>
 {tc("إدارة فروع المقهى", "Manage cafe branches")}
 </CardDescription>
 </div>
 {isAdmin && (
 <>
 <Button 
 data-testid="button-add-branch"
 onClick={() => setIsAddBranchOpen(true)}
 className="bg-accent hover:bg-accent"
 >
 <Plus className="w-4 h-4 ml-2" />
 {tc("إضافة فرع", "Add Branch")}
 </Button>
 <Dialog open={isAddBranchOpen} onOpenChange={setIsAddBranchOpen}>
 <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-card">
 <DialogHeader>
 <DialogTitle className="text-primary text-xl">{tc("إضافة فرع جديد", "Add New Branch")}</DialogTitle>
 </DialogHeader>
 <div className="grid gap-4 py-4">
 <div className="grid gap-2">
 <Label htmlFor="nameAr">{tc("اسم الفرع (عربي) *", "Branch Name (Arabic) *")}</Label>
 <Input
 id="nameAr"
 value={branchForm.nameAr}
 onChange={(e) => setBranchForm({ ...branchForm, nameAr: e.target.value })}
 placeholder={tc("مثال: فرع الرياض", "e.g. Riyadh Branch")}
 data-testid="input-branch-name-ar"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="nameEn">{tc("اسم الفرع (إنجليزي)", "Branch Name (English)")}</Label>
 <Input
 id="nameEn"
 value={branchForm.nameEn}
 onChange={(e) => setBranchForm({ ...branchForm, nameEn: e.target.value })}
 placeholder="Example: Riyadh Branch"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="address">{tc("العنوان *", "Address *")}</Label>
 <Input
 id="address"
 value={branchForm.address}
 onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
 placeholder={tc("مثال: شارع الملك فهد", "e.g. King Fahd St")}
 data-testid="input-branch-address"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="city">{tc("المدينة*", "City *")}</Label>
 <Input
 id="city"
 value={branchForm.city}
 onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
 placeholder={tc("مثال: الرياض", "e.g. Riyadh")}
 data-testid="input-branch-city"
 />
 </div>
 <div className="grid gap-2">
 <Label htmlFor="phone">{tc("رقم الهاتف *", "Phone *")}</Label>
 <Input
 id="phone"
 value={branchForm.phone}
 onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
 placeholder={tc("مثال: 0501234567", "e.g. 0501234567")}
 data-testid="input-branch-phone"
 />
 </div>
 <div className="space-y-4 border border-border rounded-lg p-4 bg-muted">
 <Label className="text-primary font-semibold flex items-center gap-2">
 <UserCheck className="w-4 h-4" />
 {tc("تعيين مدير الفرع", "Assign Branch Manager")}
 </Label>
 
 <div className="flex gap-4">
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="managerType"
 checked={managerAssignmentType === "existing"}
 onChange={() => setManagerAssignmentType("existing")}
 className="w-4 h-4 accent-primary"
 data-testid="radio-existing-manager"
 />
 <span className="text-foreground">{tc("تعيين مدير موجود", "Assign existing manager")}</span>
 </label>
 <label className="flex items-center gap-2 cursor-pointer">
 <input
 type="radio"
 name="managerType"
 checked={managerAssignmentType === "new"}
 onChange={() => setManagerAssignmentType("new")}
 className="w-4 h-4 accent-primary"
 data-testid="radio-new-manager"
 />
 <span className="text-foreground">{tc("إنشاء مدير جديد", "Create new manager")}</span>
 </label>
 </div>
 
 {managerAssignmentType === "existing" ? (
 <div className="grid gap-2">
 <Label>{tc("اختر المدير", "Select manager")}</Label>
 <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
 <SelectTrigger data-testid="select-existing-manager">
 <SelectValue placeholder={tc("اختر مديراً موجوداً", "Select an existing manager")} />
 </SelectTrigger>
 <SelectContent>
 {availableManagers.length === 0 ? (
 <SelectItem value="none" disabled>{tc("لا يوجد مديرون متاحون", "No managers available")}</SelectItem>
 ) : (
 availableManagers.map((emp) => (
 <SelectItem key={emp.id} value={emp.id || ""}>
 {emp.fullName} - {emp.role === "admin" ? "مدير عام" : "مدير"}
 </SelectItem>
 ))
 )}
 </SelectContent>
 </Select>
 {availableManagers.length === 0 && (
 <p className="text-xs text-muted-foreground">{tc("لا يوجد مديرون متاحون. يمكنك إنشاء مدير جديد.", "No managers available. You can create a new manager.")}</p>
 )}
 </div>
 ) : (
 <div className="grid gap-3">
 <div className="grid gap-1.5">
 <Label htmlFor="mgr-name">{tc("الاسم الكامل *", "Full Name *")}</Label>
 <Input
 id="mgr-name"
 value={newManagerForm.fullName}
 onChange={(e) => setNewManagerForm({ ...newManagerForm, fullName: e.target.value })}
 placeholder={tc("الاسم الكامل للمدير", "Manager's full name")}
 data-testid="input-new-manager-name"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="mgr-user">{tc("اسم المستخدم *", "Username *")}</Label>
 <Input
 id="mgr-user"
 value={newManagerForm.username}
 onChange={(e) => setNewManagerForm({ ...newManagerForm, username: e.target.value })}
 placeholder={tc("اسم المستخدم للدخول", "Login username")}
 data-testid="input-new-manager-username"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="mgr-phone">{tc("رقم الجوال *", "Phone *")}</Label>
 <Input
 id="mgr-phone"
 value={newManagerForm.phone}
 onChange={(e) => setNewManagerForm({ ...newManagerForm, phone: e.target.value })}
 placeholder={tc("مثال: 05XXXXXXXX", "e.g. 05XXXXXXXX")}
 data-testid="input-new-manager-phone"
 />
 </div>
 </div>
 )}
 </div>
 
 <div className="grid gap-4">
 <div className="grid gap-2 relative">
 <Label>{tc("اسم الفرع - ابحث عن الموقع", "Branch Location - Search")}</Label>
 <div className="relative">
 <Input
 type="text"
 placeholder={tc("ابحث عن الفرع... (مثال: الرياض، الدمام)", "Search location... (e.g. Riyadh)")}
 value={branchSearchQuery}
 onChange={(e) => handleBranchSearchChange(e.target.value)}
 onFocus={() => branchSearchQuery && setShowBranchResults(true)}
 className="text-right pr-10"
 data-testid="input-branch-search"
 />
 {isSearchingBranch && (
 <div className="absolute right-3 top-3 text-primary">
 <div className="animate-spin">⟳</div>
 </div>
 )}

 {showBranchResults && branchSearchResults.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
 {branchSearchResults.map((result, index) => (
 <button
 key={index}
 onClick={() => handleSelectBranchLocation(result)}
 className="w-full text-right px-4 py-3 hover:bg-primary/10 dark:hover:bg-primary/20 border-b border-border last:border-b-0 transition-colors"
 data-testid={`branch-location-result-${index}`}
 >
 <div className="flex items-end gap-2 justify-end">
 <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
 <span className="text-sm text-foreground">{result.name}</span>
 </div>
 </button>
 ))}
 </div>
 )}

 {showBranchResults && branchSearchResults.length === 0 && branchSearchQuery && !isSearchingBranch && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 p-3">
 <p className="text-sm text-muted-foreground text-right">{tc("لم يتم العثور على نتائج", "No results found")}</p>
 </div>
 )}
 </div>
 </div>

 <div className="grid gap-2">
 <Label>{tc("موقع الفرع على الخريطة", "Branch Location on Map")}</Label>
 <div className="h-[250px] rounded-lg overflow-hidden border border-border">
 <BranchLocationPicker
 initialLat={branchForm.latitude}
 initialLng={branchForm.longitude}
 onLocationSelect={(lat: number, lng: number) => setBranchForm({ ...branchForm, latitude: lat, longitude: lng })}
 />
 </div>
 <div className="flex gap-4 text-xs text-muted-foreground">
 <span>{tc("خط العرض", "Lat")}: 24.713600</span>
 <span>{tc("خط الطول", "Lng")}: 46.675300</span>
 </div>
 </div>
 </div>
 
 <Button 
 onClick={handleCreateBranch} 
 disabled={createBranchMutation.isPending}
 className="w-full h-12 text-lg"
 data-testid="button-save-branch"
 >
 {createBranchMutation.isPending ? tc("جاري الحفظ...", "Saving...") : tc("حفظ الفرع", "Save Branch")}
 </Button>
 </div>
 </DialogContent>
 </Dialog>

 {isAdmin && (
 <Dialog open={isEditBranchOpen} onOpenChange={setIsEditBranchOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="text-2xl font-bold">{tc("تعديل الفرع", "Edit Branch")}</DialogTitle>
 </DialogHeader>
 <div className="grid gap-4 py-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="grid gap-1.5">
 <Label htmlFor="edit-name-ar">{tc("اسم الفرع بالعربية *", "Branch Name (Arabic) *")}</Label>
 <Input
 id="edit-name-ar"
 value={branchForm.nameAr}
 onChange={(e) => setBranchForm({ ...branchForm, nameAr: e.target.value })}
 placeholder={tc("مثال: فرع الرياض", "e.g. Riyadh Branch")}
 data-testid="input-edit-name-ar"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="edit-name-en">{tc("اسم الفرع بالإنجليزية", "Branch Name (English)")}</Label>
 <Input
 id="edit-name-en"
 value={branchForm.nameEn}
 onChange={(e) => setBranchForm({ ...branchForm, nameEn: e.target.value })}
 placeholder="مثال: Riyadh Branch"
 data-testid="input-edit-name-en"
 />
 </div>
 </div>

 <div className="grid gap-1.5">
 <Label htmlFor="edit-address">{tc("العنوان *", "Address *")}</Label>
 <Input
 id="edit-address"
 value={branchForm.address}
 onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
 placeholder={tc("العنوان الكامل", "Full address")}
 data-testid="input-edit-address"
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div className="grid gap-1.5">
 <Label htmlFor="edit-phone">{tc("رقم الجوال *", "Phone *")}</Label>
 <Input
 id="edit-phone"
 value={branchForm.phone}
 onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
 placeholder="مثال: 0501234567"
 data-testid="input-edit-phone"
 />
 </div>
 <div className="grid gap-1.5">
 <Label htmlFor="edit-city">{tc("المدينة *", "City *")}</Label>
 <Input
 id="edit-city"
 value={branchForm.city}
 onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
 placeholder={tc("المدينة", "City")}
 data-testid="input-edit-city"
 />
 </div>
 </div>

 <div className="grid gap-1.5">
 <Label htmlFor="edit-manager-name">{tc("اسم المدير", "Manager Name")}</Label>
 <Input
 id="edit-manager-name"
 value={branchForm.managerName}
 onChange={(e) => setBranchForm({ ...branchForm, managerName: e.target.value })}
 placeholder={tc("اسم مدير الفرع", "Branch manager name")}
 data-testid="input-edit-manager-name"
 />
 </div>

 <div className="grid gap-4">
 <div className="grid gap-2 relative">
 <Label>{tc("اسم الفرع - ابحث عن الموقع", "Branch Location - Search")}</Label>
 <div className="relative">
 <Input
 type="text"
 placeholder={tc("ابحث عن الفرع... (مثال: الرياض، الدمام)", "Search location... (e.g. Riyadh)")}
 value={branchSearchQuery}
 onChange={(e) => handleBranchSearchChange(e.target.value)}
 onFocus={() => branchSearchQuery && setShowBranchResults(true)}
 className="text-right pr-10"
 data-testid="input-branch-search-edit"
 />
 {isSearchingBranch && (
 <div className="absolute right-3 top-3 text-primary">
 <div className="animate-spin">⟳</div>
 </div>
 )}

 {showBranchResults && branchSearchResults.length > 0 && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
 {branchSearchResults.map((result, index) => (
 <button
 key={index}
 onClick={() => handleSelectBranchLocation(result)}
 className="w-full text-right px-4 py-3 hover:bg-primary/10 dark:hover:bg-primary/20 border-b border-border last:border-b-0 transition-colors"
 data-testid={`branch-location-result-edit-${index}`}
 >
 <div className="flex items-end gap-2 justify-end">
 <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
 <span className="text-sm text-foreground">{result.name}</span>
 </div>
 </button>
 ))}
 </div>
 )}

 {showBranchResults && branchSearchResults.length === 0 && branchSearchQuery && !isSearchingBranch && (
 <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-card border border-border rounded-md shadow-lg z-50 p-3">
 <p className="text-sm text-muted-foreground text-right">{tc("لم يتم العثور على نتائج", "No results found")}</p>
 </div>
 )}
 </div>
 </div>

 <div className="grid gap-2">
 <Label>{tc("موقع الفرع على الخريطة", "Branch Location on Map")}</Label>
 <div className="h-[250px] rounded-lg overflow-hidden border border-border">
 <BranchLocationPicker
 initialLat={branchForm.latitude}
 initialLng={branchForm.longitude}
 onLocationSelect={(lat: number, lng: number) => setBranchForm({ ...branchForm, latitude: lat, longitude: lng })}
 />
 </div>
 <div className="flex gap-4 text-xs text-muted-foreground">
 <span>{tc("خط العرض", "Lat")}: {branchForm.latitude.toFixed(6)}</span>
 <span>{tc("خط الطول", "Lng")}: {branchForm.longitude.toFixed(6)}</span>
 </div>
 </div>
 </div>

 <Button 
 onClick={handleEditBranch} 
 disabled={updateBranchMutation.isPending}
 className="w-full h-12 text-lg"
 data-testid="button-save-edit-branch"
 >
 {updateBranchMutation.isPending ? tc("جاري التحديث...", "Updating...") : tc("تحديث الفرع", "Update Branch")}
 </Button>
 </div>
 </DialogContent>
 </Dialog>
 )}
 </>
 )}
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {branches.length === 0 ? (
 <EmptyState title={tc("لا يوجد فروع", "No branches")} description={tc("لم يتم العثور على فروع مسجلة", "No registered branches found")} />
 ) : (
 branches.map((branch) => (
 <Card key={branch.id} className="border-border/50 hover:border-primary/50 transition-colors">
 <CardContent className="p-4">
 <div className="flex justify-between items-start mb-4">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
 <MapPin className="w-5 h-5 text-primary" />
 </div>
 <div>
 <h3 className="font-bold text-lg">{branch.nameAr}</h3>
 <p className="text-sm text-muted-foreground">{branch.city}</p>
 </div>
 </div>
 <Badge variant={branch.isActive === 1 || branch.isActive === true ? "default" : "secondary"}>
 {branch.isActive === 1 || branch.isActive === true ? tc("نشط", "Active") : tc("غير نشط", "Inactive")}
 </Badge>
 </div>
 <div className="space-y-2 text-sm text-muted-foreground">
 <div className="flex items-center gap-2">
 <Users className="w-4 h-4" />
 <span>{branch.managerName || tc('لا يوجد مدير', 'No manager')}</span>
 </div>
 <div className="flex items-center gap-2">
 <Activity className="w-4 h-4" />
 <span>{branch.phone}</span>
 </div>
 <div className="flex items-center gap-2">
 <MapPin className="w-4 h-4" />
 <span>{branch.address}</span>
 </div>
 </div>
 {isAdmin && (
 <div className="flex gap-2 mt-4 pt-4 border-t border-border">
 <Button 
 variant="outline" 
 size="sm" 
 className="flex-1"
 onClick={() => openEditDialog(branch)}
 disabled={updateBranchMutation.isPending}
 data-testid="button-edit-branch"
 >
 <Edit2 className="w-4 h-4 ml-2" />
 {tc("تعديل", "Edit")}
 </Button>
 <Button 
 variant="outline" 
 size="sm" 
 className="flex-1"
 onClick={() => {
 if (confirm(tc('هل أنت متأكد من حذف هذا الفرع؟', 'Are you sure you want to delete this branch?'))) {
 deleteBranchMutation.mutate(branch.id);
 }
 }}
 disabled={deleteBranchMutation.isPending}
 data-testid="button-delete-branch"
 >
 <Trash2 className="w-4 h-4 ml-2" />
 {tc("حذف", "Delete")}
 </Button>
 </div>
 )}
 </CardContent>
 </Card>
 ))
 )}
 </div>
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="coupons" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>{tc("إدارة أكواد الخصم", "Coupon Management")}</CardTitle>
 <CardDescription>{tc("إنشاء وإدارة أكواد الخصم للعملاء", "Create and manage discount codes for customers")}</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <CouponManagement employeeId={manager?.id || ''} />
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="delivery" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>{tc("إدارة التوصيل", "Delivery Management")}</CardTitle>
 <CardDescription>{tc("إدارة مناديب التوصيل ومناطق الخدمة والربط مع المنصات الخارجية", "Manage delivery drivers, service areas and third-party integrations")}</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <DeliveryManagement />
 </CardContent>
 </Card>
 </TabsContent>

 <TabsContent value="erp" className="space-y-4">
 <Card>
 <CardHeader>
 <div className="flex items-center justify-between">
 <div>
 <CardTitle>{tc("نظام المحاسبة والفواتير", "Accounting & Invoices")}</CardTitle>
 <CardDescription>{tc("إدارة الحسابات والفواتير الضريبية ومتابعة الأرباح", "Manage accounts, tax invoices and profit tracking")}</CardDescription>
 </div>
 <Button onClick={() => setLocation('/erp/accounting')} data-testid="button-open-erp">
 <ExternalLink className="w-4 h-4 ml-2" />
 {tc("فتح نظام المحاسبة", "Open Accounting")}
 </Button>
 </div>
 </CardHeader>
 <CardContent>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
 <CardContent className="p-4 flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
 <TrendingUp className="w-6 h-6 text-green-600" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">{tc("إجمالي الإيرادات", "Total Revenue")}</p>
 <p className="text-2xl font-bold text-green-600">{totalRevenue.toFixed(2)} <SarIcon /></p>
 </div>
 </CardContent>
 </Card>
 <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
 <CardContent className="p-4 flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
 <Receipt className="w-6 h-6 text-blue-600" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">{tc("عدد الطلبات", "Total Orders")}</p>
 <p className="text-2xl font-bold text-blue-600">{filteredOrders.length}</p>
 </div>
 </CardContent>
 </Card>
 <Card className="bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800">
 <CardContent className="p-4 flex items-center gap-4">
 <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
 <DollarSign className="w-6 h-6 text-purple-600" />
 </div>
 <div>
 <p className="text-sm text-muted-foreground">{tc("متوسط الطلب", "Avg. Order")}</p>
 <p className="text-2xl font-bold text-purple-600">{filteredOrders.length > 0 ? (totalRevenue / filteredOrders.length).toFixed(2) : '0.00'} <SarIcon /></p>
 </div>
 </CardContent>
 </Card>
 </div>
 <div className="mt-4 p-4 bg-muted/30 rounded-lg">
 <p className="text-sm text-muted-foreground mb-2">{tc("للوصول إلى نظام المحاسبة الكامل مع:", "Access the full accounting system with:")}</p>
 <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
 <li>{tc("دليل الحسابات", "Chart of Accounts")}</li>
 <li>{tc("قيود اليومية", "Journal Entries")}</li>
 <li>{tc("ميزان المراجعة", "Trial Balance")}</li>
 <li>{tc("قائمة الدخل والميزانية العمومية", "Income Statement & Balance Sheet")}</li>
 <li>{tc("الفواتير الضريبية المتوافقة مع ZATCA", "ZATCA-compliant Tax Invoices")}</li>
 </ul>
 </div>
 </CardContent>
 </Card>
 </TabsContent>
 </Tabs>
         </div>
       </div>
     </main>
   </div>
 </div>
 <MobileBottomNav manager={manager} />
 {import.meta.env.DEV && <DemoDataManager open={demoManagerOpen} onOpenChange={setDemoManagerOpen} />}
 </>
 );
}