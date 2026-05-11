import { useTranslate } from "@/lib/useTranslate";
import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notification-bell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Coffee, LogOut, ShoppingCart, ClipboardList, User, Award, Gift, Sparkles, Download, IdCard, Settings, BarChart3, Table, Lock, Clock, MonitorSmartphone, ChefHat, Wallet, Warehouse, Eye, Bell, CheckCircle, AlertCircle, Calendar, FileText, MapPin, X, Wifi, WifiOff, Utensils } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/states";
import { EmployeeSidebar } from "@/components/employee-sidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import html2canvas from "html2canvas";
const chefsplaceLogoStaff = "/logo.png";
import type { Employee } from "@shared/schema";
import { useOrderWebSocket } from "@/lib/websocket";
import { queryClient } from "@/lib/queryClient";
import { playNotificationSound } from "@/lib/notification-sounds";

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  numberOfDays: number;
  rejectionReason?: string;
  createdAt: string;
}

interface Order {
  id: string;
  orderNumber: string;
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  items?: number;
  customerName?: string;
  createdAt: string;
}

interface Notification {
  id: string;
  type: 'leave' | 'order' | 'kitchen' | 'manager' | 'alert';
  title: string;
  message: string;
  status?: 'pending' | 'approved' | 'rejected';
  timestamp: Date;
  icon?: string;
  actionLink?: string;
}

export default function EmployeeDashboard() {
  const [, setLocation] = useLocation();
  const tc = useTranslate();
  const { t, i18n } = useTranslation();
  const dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Set SEO metadata
  useEffect(() => {
    document.title = "Employee Dashboard - مكان الشيف البخاري | Order Management";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', 'مكان الشيف البخاري Employee Dashboard - Track orders, leave requests and notifications');
  }, []);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);
  const lateOrders = pendingOrders.filter(o => {
    if (!o.createdAt) return false;
    return (Date.now() - new Date(o.createdAt).getTime()) > 15 * 60 * 1000;
  });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState<{ orderNumber?: string; orderType?: string; timestamp: Date } | null>(null);
  const [caféAddress, setCaféAddress] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: string; lon: string }>>([]);
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // WebSocket hook for real-time order notifications
  const { isConnected: wsConnected } = useOrderWebSocket({
    clientType: "pos",
    branchId: employee?.branchId?.toString(),
    onNewOrder: (order) => {
      fetchPendingOrders();
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      if (order?.channel !== 'pos') {
        setNewOrderAlert({
          orderNumber: order?.orderNumber || order?.id,
          orderType: order?.orderType,
          timestamp: new Date(),
        });
        setTimeout(() => setNewOrderAlert(null), 15000);
      }
      if (order?.channel !== 'pos') {
        const isOnline = order?.channel === 'online' || order?.channel === 'web'
          || order?.orderType === 'online' || !order?.channel;
        if (isOnline) {
          playNotificationSound('cashierOrder', 1.0);
        } else {
          playNotificationSound('newOrder', 0.85);
        }
      }
    },
    onOrderUpdated: () => {
      fetchPendingOrders();
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    enabled: !!employee,
  });

  useEffect(() => {
    const storedEmployee = localStorage.getItem("currentEmployee");
    const storedAddress = localStorage.getItem("caféAddress");
    if (storedEmployee) {
      try {
        const emp = JSON.parse(storedEmployee);
        setEmployee(emp);
        
        // Parallel fetching for faster initial load
        fetchAllNotifications().finally(() => {
          setIsLoading(false);
        });
        
        // Auto-refresh interval (5 seconds)
        const interval = setInterval(() => {
          fetchAllNotifications();
        }, 5000);
        return () => clearInterval(interval);
      } catch (e) {
        window.location.href = "/employee/login";
      }
    } else {
      window.location.href = "/employee/login";
    }
    if (storedAddress) {
      setCaféAddress(storedAddress);
    }
  }, [setLocation]);

  const fetchAllNotifications = async () => {
    await Promise.all([
      fetchLeaveRequests(),
      fetchPendingOrders(),
      fetchKitchenOrders()
    ]);
  };

  const fetchLeaveRequests = async () => {
    try {
      const response = await fetch("/api/leave-requests", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setLeaveRequests(data);
        return data;
      }
    } catch (error) {
      console.error("Error fetching leave requests:", error);
    }
    return [];
  };

  const fetchPendingOrders = async () => {
    try {
      const response = await fetch("/api/orders?status=pending", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setPendingOrders(data || []);
        return data;
      } else if (response.status === 401) {
        // No auto-redirect here to prevent loops, AuthGuard handles it
        console.warn("Unauthorized API call in dashboard");
      }
    } catch (error) {
      console.error("Error fetching pending orders:", error);
    }
    return [];
  };

  const fetchKitchenOrders = async () => {
    try {
      const response = await fetch("/api/orders?status=preparing", {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setKitchenOrders(data || []);
        return data;
      }
    } catch (error) {
      console.error("Error fetching kitchen orders:", error);
    }
    return [];
  };

  const searchLocations = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
      );
      const data = await response.json();
      setSearchResults(data || []);
      setShowResults(true);
    } catch (error) {
      console.error("Error searching locations:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(value);
    }, 500);
  };

  const handleSelectLocation = (location: { name: string; lat: string; lon: string }) => {
    setCaféAddress(location.name);
    localStorage.setItem("caféAddress", location.name);
    localStorage.setItem("caféLat", location.lat);
    localStorage.setItem("caféLon", location.lon);
    setSearchQuery("");
    setShowResults(false);
    setSearchResults([]);
  };

  useEffect(() => {
    if (employee?.id) {
      generateQRCode(employee.id);
    }
  }, [employee?.id]);

  useEffect(() => {
    if (leaveRequests.length > 0 || pendingOrders.length > 0 || kitchenOrders.length > 0) {
      const allNotifications: Notification[] = [];

      // Leave request notifications
      leaveRequests.forEach((request) => {
        const statusKey = request.status === 'pending' ? 'employee.leave_message_pending' : request.status === 'approved' ? 'employee.leave_message_approved' : 'employee.leave_message_rejected';
        allNotifications.push({
          id: request.id,
          type: 'leave',
          title: t('employee.leave_request'),
          message: t('employee.leave_notif_msg', { status: t(statusKey), start: new Date(request.startDate).toLocaleDateString(), end: new Date(request.endDate).toLocaleDateString() }),
          status: request.status,
          timestamp: new Date(request.createdAt)
        });
      });

      // Pending orders notifications
      if (pendingOrders.length > 0) {
        allNotifications.push({
          id: 'pending-orders-' + Date.now(),
          type: 'order',
          title: t('employee.pending_orders_notif'),
          message: t('employee.pending_orders_message', { count: pendingOrders.length }),
          timestamp: new Date(),
          actionLink: '/employee/orders'
        });
      }

      // Kitchen orders notifications
      if (kitchenOrders.length > 0) {
        allNotifications.push({
          id: 'kitchen-orders-' + Date.now(),
          type: 'kitchen',
          title: t('employee.kitchen_orders_notif'),
          message: t('employee.kitchen_orders_message', { count: kitchenOrders.length }),
          timestamp: new Date(),
          actionLink: '/employee/kitchen'
        });
      }

      // Manager alerts for managers
      if (employee?.role === 'manager' || employee?.role === 'admin' || employee?.role === 'owner') {
        const totalPending = pendingOrders.length + kitchenOrders.length;
        if (totalPending > 0) {
          allNotifications.push({
            id: 'manager-alert-' + Date.now(),
            type: 'manager',
            title: t('employee.manager_alert'),
            message: t('employee.manager_alert_message', { count: totalPending }),
            timestamp: new Date(),
            actionLink: '/manager/dashboard'
          });
        }
      }

      setNotifications(allNotifications);
    } else {
      setNotifications([]);
    }
  }, [leaveRequests, pendingOrders, kitchenOrders, employee?.role, t, i18n.language]);

  const generateQRCode = async (employeeId: string) => {
    try {
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(employeeId, {
        width: 200,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(url);
    } catch (err) {
      console.error('QR generation error:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("currentEmployee");
    setLocation("/employee/gateway");
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: '#1a1410',
        scale: 2
      });
      
      const link = document.createElement('a');
      link.download = `employee-card-${employee?.username}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (error) {
      console.error('Error downloading card:', error);
    }
  };

  if (isLoading && !employee) {
    return (
      <div dir={dir} className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingState message={t('employee.loading')} />
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  const getRoleLabel = (role: string) => {
    switch(role) {
      case "owner": return t('employee.role_owner');
      case "admin": return t('employee.role_admin');
      case "manager": return t('employee.role_manager');
      case "driver": return t('employee.role_driver');
      default: return t('employee.role_cashier');
    }
  };

  const getRoleVariant = (role: string): "default" | "destructive" | "secondary" | "outline" => {
    switch(role) {
      case "owner": return "destructive";
      case "admin": return "secondary";
      case "manager": return "default";
      case "driver": return "outline";
      default: return "secondary";
    }
  };

  const roleLabel = getRoleLabel(employee.role || "cashier");
  const roleVariant = getRoleVariant(employee.role || "cashier");

  return (
    <div dir={dir} className="flex h-screen bg-gray-50">
      <EmployeeSidebar employee={employee} onLogout={handleLogout} />
      <main className="flex-1 overflow-auto pb-16 sm:pb-0">
        <div className="flex sm:hidden items-center justify-between px-4 py-3 border-b bg-white sticky top-0 z-40">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold">{t('employee.control_panel')}</h1>
            <span
              className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${wsConnected ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}
              data-testid="badge-ws-status-mobile"
            >
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            </span>
          </div>
          <div className="flex items-center gap-2">
            {lateOrders.length > 0 && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-pending-orders-mobile">
                {lateOrders.length}
              </Badge>
            )}
            <NotificationBell
              userId={employee?.id}
              userType="employee"
              clientType="pos"
              branchId={employee?.branchId}
            />
            <span className="text-sm text-muted-foreground">{employee?.fullName}</span>
          </div>
        </div>

        {newOrderAlert && (
          <div className="mx-3 sm:mx-6 mt-3 animate-in slide-in-from-top duration-300" data-testid="alert-new-order">
            <Card className="border-green-500 dark:border-green-600 bg-green-50 dark:bg-green-950/50 relative overflow-visible">
              <div className="absolute inset-0 rounded-md border-2 border-green-400 dark:border-green-500 animate-pulse pointer-events-none" />
              <CardContent className="flex items-center justify-between gap-3 py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                    <p className="font-bold text-green-800 dark:text-green-300">{t('employee.new_order_alert')}</p>
                    <p className="text-sm text-green-700 dark:text-green-400">
                      {newOrderAlert.orderNumber ? t('employee.new_order_number', { number: newOrderAlert.orderNumber }) : t('employee.new_order')}
                      {newOrderAlert.orderType === 'delivery' ? t('employee.new_order_delivery') : newOrderAlert.orderType === 'takeaway' ? t('employee.new_order_takeaway') : ''}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setNewOrderAlert(null)}
                  data-testid="button-dismiss-alert"
                >
                  <X className="w-4 h-4 text-green-700 dark:text-green-400" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">{t('employee.dashboard_title')}</h1>
                <h2 className="text-primary mt-1">{t('employee.welcome', { name: employee?.fullName })}</h2>
              </div>
              <div className="hidden sm:flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${wsConnected ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}`}
                  data-testid="badge-ws-status"
                >
                  {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {wsConnected ? t('employee.connected') : t('employee.disconnected')}
                </span>
                {lateOrders.length > 0 && (
                  <Badge variant="destructive" data-testid="badge-pending-orders-count">
                    <ShoppingCart className="w-3 h-3 ml-1" />
                    {t('employee.pending_orders', { count: lateOrders.length })}
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-1">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-muted overflow-x-auto">
              <TabsTrigger value="profile" data-testid="tab-profile" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <User className="w-4 h-4 ml-2" />
                {t('employee.profile')}
              </TabsTrigger>
              <TabsTrigger value="card" data-testid="tab-card" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <IdCard className="w-4 h-4 ml-2" />
                {t('employee.employee_card')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="profile">
              <Card className="border-border">
                <div className="h-24 bg-primary/20"></div>
                <CardContent className="pt-0 -mt-12">
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center border-4 border-background mb-4">
                      <User className="w-12 h-12 text-primary-foreground" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-foreground mb-2 text-center" data-testid="text-employee-name">
                      {employee.fullName}
                    </h2>
                    
                    <Badge className="bg-[#2D9B6E] text-white hover:bg-[#2D9B6E]/90 mb-2 border-none" data-testid="badge-role">
                      {roleLabel}
                    </Badge>
                    
                    {employee.jobTitle && (
                      <div className="flex items-center gap-2 mb-4">
                        <Award className="w-4 h-4 text-[#2D9B6E]" />
                        <span className="text-muted-foreground" data-testid="text-title">{employee.jobTitle}</span>
                      </div>
                    )}
                    
                    <div className="text-center text-muted-foreground text-sm">
                      <p>{t('employee.id_label', { id: employee.id?.slice(0, 8) || 'N/A' })}</p>
                      <p className="mt-1">{t('employee.username', { name: employee.username })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="card">
              <div className="space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-primary text-sm font-bold mb-2 block">{t('employee.card_info')}</p>
                    <p className="text-muted-foreground text-xs mb-3">{t('employee.card_info_desc')}</p>
                    <div className="bg-muted border border-border rounded p-3 mt-3">
                      <p className="text-primary font-bold text-center text-lg">{employee?.id?.slice(0, 8) || 'N/A'}</p>
                      <p className="text-muted-foreground text-xs text-center mt-1">{t('employee.employee_id')}</p>
                    </div>
                  </CardContent>
                </Card>

                <div ref={cardRef} className="space-y-4">
                  <div className="bg-gradient-to-br from-primary/15 via-secondary to-accent/10 border-4 border-primary/40 rounded-2xl overflow-hidden shadow-2xl relative" data-testid="employee-card-front">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary to-accent opacity-20 rounded-bl-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-20 h-20 bg-gradient-to-tr from-accent to-primary opacity-15 rounded-tr-3xl pointer-events-none"></div>

                    <div className="bg-gradient-to-r from-primary via-primary to-primary/80 p-6 relative">
                      <div className="flex items-center justify-center gap-4 mb-2">
                        <div className="w-20 h-20 flex items-center justify-center shadow-lg rounded-lg">
                          <img src={chefsplaceLogoStaff} alt="مكان الشيف البخاري Logo" className="w-full h-full object-contain rounded-lg" />
                        </div>
                        <div className="text-white text-right">
                          <h3 className="text-2xl font-bold">مكان الشيف البخاري</h3>
                          <p className="text-white/80 text-xs">Staff Portal</p>
                        </div>
                      </div>
                      <div className="absolute top-2 left-4 text-white/20">
                        <Coffee className="w-8 h-8 opacity-40" />
                      </div>
                    </div>

                    <div className="p-8 relative">
                      <div className="grid grid-cols-3 gap-8 items-center">
                        <div className="flex flex-col items-center">
                          {employee.imageUrl ? (
                            <img
                              src={employee.imageUrl}
                              alt={employee.fullName}
                              className="w-32 h-32 rounded-full object-cover border-4 border-primary/40 shadow-lg"
                            />
                          ) : (
                            <div className="w-32 h-32 bg-gradient-to-br from-primary to-primary/70 rounded-full flex items-center justify-center shadow-lg border-4 border-primary/30">
                              <User className="w-16 h-16 text-white" />
                            </div>
                          )}
                          <div className="mt-3 text-center">
                            <p className="text-primary font-semibold text-xs font-bold">{t('employee.official_card')}</p>
                            <p className="text-primary/60 text-xs">Official Card</p>
                          </div>
                        </div>

                        <div className="text-center space-y-3 border-r-2 border-l-2 border-primary/20 px-6">
                          <div>
                            <h2 className="text-2xl font-bold text-primary/90">{employee.fullName}</h2>
                            <p className="text-primary/70 text-sm mt-1 font-semibold">{employee.jobTitle || roleLabel}</p>
                          </div>
                          
                          <div className="flex justify-center gap-2">
                            <Badge className="bg-gradient-to-r from-accent to-accent/80 text-white text-xs">
                              {roleLabel}
                            </Badge>
                          </div>

                          <div className="space-y-1 text-xs">
                            <p className="text-primary/80">
                              <span className="font-bold">ID:</span> {employee.id?.slice(0, 8) || 'N/A'}
                            </p>
                            <p className="text-primary/70 font-mono">{employee.username}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-center space-y-2">
                          <div className="bg-white p-3 rounded-xl shadow-md border-2 border-primary/30">
                            {qrCodeUrl ? (
                              <img 
                                src={qrCodeUrl}
                                alt="QR Code"
                                data-testid="img-qr-code"
                                className="w-32 h-32"
                              />
                            ) : (
                              <div className="w-32 h-32 bg-gray-200 flex items-center justify-center rounded">
                                <p className="text-xs text-gray-500">{t('employee.qr_loading')}</p>
                              </div>
                            )}
                          </div>
                          <p className="text-primary font-semibold text-xs font-bold">{t('employee.scan_login')}</p>
                          <p className="text-primary/60 text-xs">Scan Login</p>
                        </div>
                      </div>

                      <div className="mt-8 pt-6 border-t-2 border-primary/20 grid grid-cols-3 gap-4 text-center text-xs">
                        <div className="space-y-1">
                          <p className="text-primary/70 font-bold">{t('employee.phone')}</p>
                          <p className="text-primary/90 font-mono text-sm">{employee.phone || 'N/A'}</p>
                        </div>
                        <div className="space-y-1 border-r border-l border-primary/20">
                          <p className="text-primary/70 font-bold">{t('employee.role')}</p>
                          <p className="text-primary/90 font-semibold">{roleLabel}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-primary/70 font-bold">{t('employee.status')}</p>
                          <p className={`font-bold ${employee.isActivated ? 'text-green-700' : 'text-red-600'}`}>
                            {employee.isActivated ? t('employee.active') : t('employee.inactive')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="h-1 bg-gradient-to-r from-primary via-accent to-primary"></div>
                  </div>

                  <div className="bg-gradient-to-br from-primary/15 via-secondary to-accent/10 border-4 border-primary/40 rounded-2xl overflow-hidden shadow-2xl p-8 relative" data-testid="employee-card-back">
                    <div className="absolute top-4 right-4 text-primary opacity-20 pointer-events-none">
                      <Coffee className="w-12 h-12 opacity-30" />
                    </div>
                    
                    <div className="max-w-2xl mx-auto space-y-6 relative">
                      <div className="text-center space-y-2 mb-6">
                        <h3 className="text-primary/90 text-lg font-bold">{t('employee.terms_of_use')}</h3>
                        <p className="text-primary/60 text-xs">Terms of Use</p>
                      </div>

                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2 text-right">
                          <h4 className="text-primary/90 font-bold text-sm flex items-center justify-end gap-2">
                            <span>{t('employee.responsibilities')}</span>
                          </h4>
                          <ul className="text-primary/80 text-xs space-y-1 leading-relaxed">
                            <li>• {t('employee.responsibilities_1')}</li>
                            <li>• {t('employee.responsibilities_2')}</li>
                            <li>• {t('employee.responsibilities_3')}</li>
                            <li>• {t('employee.responsibilities_4')}</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-2 text-right">
                          <h4 className="text-primary/90 font-bold text-sm flex items-center justify-end gap-2">
                            <span>{t('employee.benefits')}</span>
                          </h4>
                          <ul className="text-primary/80 text-xs space-y-1 leading-relaxed">
                            <li>{t('employee.benefits_1')}</li>
                            <li>{t('employee.benefits_2')}</li>
                            <li>{t('employee.benefits_3')}</li>
                            <li>{t('employee.benefits_4')}</li>
                          </ul>
                        </div>
                      </div>

                      <div className="border-t-2 border-primary/20 pt-6 mt-6 space-y-2 text-right">
                        <p className="text-primary/90 text-xs">{t('employee.website')}</p>
                        <p className="text-primary/60 text-xs">{t('employee.rights')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={downloadCard}
                  className="w-full"
                  size="lg"
                  data-testid="button-download-card"
                >
                  <Download className="w-5 h-5 ml-2" />
                  {t('employee.download_card')}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-right">{t('employee.available_services')}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              <Button
                size="lg"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/cashier")}
                data-testid="button-cashier"
              >
                <ShoppingCart className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.cashier_system')}</div>
                  <div className="text-sm opacity-90">{t('employee.cashier_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/pos")}
                data-testid="button-pos-system"
              >
                <MonitorSmartphone className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.pos_system')}</div>
                  <div className="text-sm opacity-90">{t('employee.pos_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/orders")}
                data-testid="button-orders"
              >
                <ClipboardList className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.orders_management')}</div>
                  <div className="text-sm opacity-90">{t('employee.orders_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/orders-display")}
                data-testid="button-orders-display"
              >
                <MonitorSmartphone className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.orders_display')}</div>
                  <div className="text-sm opacity-90">{t('employee.orders_display_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/kitchen")}
                data-testid="button-kitchen-display"
              >
                <ChefHat className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.kitchen_display')}</div>
                  <div className="text-sm opacity-90">{t('employee.kitchen_display_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/attendance")}
                data-testid="button-attendance"
              >
                <Clock className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.attendance')}</div>
                  <div className="text-sm opacity-90">{t('employee.attendance_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/menu-management")}
                data-testid="button-menu-management"
              >
                <Settings className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.drinks_management')}</div>
                  <div className="text-sm opacity-90">{t('employee.drinks_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/menu-management?type=food")}
                data-testid="button-food-management"
              >
                <Utensils className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">إدارة المأكولات</div>
                  <div className="text-sm opacity-90">قائمة الطعام والوجبات</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-950/20"
                onClick={() => setLocation("/employee/product-reservations")}
                data-testid="button-product-reservations"
              >
                <Calendar className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">حجوزات المنتجات</div>
                  <div className="text-sm opacity-90">إدارة الطلبات المحجوزة</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="secondary"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/table-orders")}
                data-testid="button-table-orders"
              >
                <Coffee className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.table_orders')}</div>
                  <div className="text-sm opacity-90">{t('employee.table_orders_desc')}</div>
                </div>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className="h-32 flex flex-col items-center justify-center gap-3"
                onClick={() => setLocation("/employee/tables")}
                data-testid="button-tables"
              >
                <Table className="w-10 h-10" />
                <div className="text-center">
                  <div className="font-bold text-lg">{t('employee.tables')}</div>
                  <div className="text-sm opacity-90">{t('employee.tables_desc')}</div>
                </div>
              </Button>

              {(employee.role === "manager" || employee.role === "owner" || employee.role === "admin") && (
                <>
                  <Button
                    size="lg"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    onClick={() => setLocation("/manager/dashboard")}
                    data-testid="button-manager-dashboard"
                  >
                    <BarChart3 className="w-10 h-10" />
                    <div className="text-center">
                      <div className="font-bold text-lg">{t('employee.manager_dashboard')}</div>
                      <div className="text-sm opacity-90">{t('employee.manager_dashboard_desc')}</div>
                    </div>
                  </Button>

                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    onClick={() => setLocation("/admin/settings")}
                    data-testid="button-admin-settings"
                  >
                    <Settings className="w-10 h-10 text-accent" />
                    <div className="text-center">
                      <div className="font-bold text-lg">{t('employee.system_management')}</div>
                      <div className="text-sm opacity-90">{t('employee.system_desc')}</div>
                    </div>
                  </Button>
                  
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    onClick={() => setLocation("/manager/employees")}
                    data-testid="button-manager-employees"
                  >
                    <User className="w-10 h-10" />
                    <div className="text-center">
                      <div className="font-bold text-lg">{t('employee.employees_management')}</div>
                      <div className="text-sm opacity-90">{t('employee.employees_desc')}</div>
                    </div>
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    onClick={() => setLocation("/manager/accounting")}
                    data-testid="button-accounting"
                  >
                    <Wallet className="w-10 h-10" />
                    <div className="text-center">
                      <div className="font-bold text-lg">{t('employee.accounting')}</div>
                      <div className="text-sm opacity-90">{t('employee.accounting_desc')}</div>
                    </div>
                  </Button>

                  <Button
                    size="lg"
                    variant="secondary"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    onClick={() => setLocation("/manager/inventory")}
                    data-testid="button-inventory"
                  >
                    <Warehouse className="w-10 h-10" />
                    <div className="text-center">
                      <div className="font-bold text-lg">{t('employee.inventory')}</div>
                      <div className="text-sm opacity-90">{t('employee.inventory_desc')}</div>
                    </div>
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    className="h-32 flex flex-col items-center justify-center gap-3"
                    onClick={() => setLocation("/menu-view")}
                    data-testid="button-menu-view"
                  >
                    <Eye className="w-10 h-10" />
                    <div className="text-center">
                      <div className="font-bold text-lg">{t('employee.menu_view')}</div>
                      <div className="text-sm opacity-90">{t('employee.menu_view_desc')}</div>
                    </div>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-right flex items-center gap-2 flex-wrap">
                <Bell className="w-5 h-5" />
                {t('employee.notifications_title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">{t('employee.no_notifications')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="border border-border rounded-lg p-4 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => notification.actionLink && setLocation(notification.actionLink)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Leave notification icon */}
                        {notification.type === 'leave' && (
                          <>
                            {notification.status === 'approved' && (
                              <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                            )}
                            {notification.status === 'rejected' && (
                              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            )}
                            {notification.status === 'pending' && (
                              <Clock className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            )}
                          </>
                        )}

                        {/* Order notification icon */}
                        {notification.type === 'order' && (
                          <ShoppingCart className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        )}

                        {/* Kitchen notification icon */}
                        {notification.type === 'kitchen' && (
                          <ChefHat className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        )}

                        {/* Manager notification icon */}
                        {notification.type === 'manager' && (
                          <BarChart3 className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
                        )}

                        <div className="flex-1 text-right">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                            <h3 className="font-bold text-primary">{notification.title}</h3>
                            {notification.status && (
                              <Badge
                                variant={
                                  notification.status === 'approved'
                                    ? 'default'
                                    : notification.status === 'rejected'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className="text-xs"
                                data-testid={`badge-status-${notification.id}`}
                              >
                                {notification.status === 'approved'
                                  ? t('employee.status_approved')
                                  : notification.status === 'rejected'
                                  ? t('employee.status_rejected')
                                  : t('employee.status_pending')}
                              </Badge>
                            )}
                            {(notification.type === 'order' || notification.type === 'kitchen' || notification.type === 'manager') && (
                              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950">
                                {t('employee.new_badge')}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(notification.timestamp).toLocaleDateString('ar-SA', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                          {notification.actionLink && (
                            <p className="text-xs text-primary mt-2 font-semibold">
                              {t('employee.click_to_go')} →
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {leaveRequests.some(r => r.status === 'pending') && (
                <Button
                  variant="outline"
                  onClick={() => setLocation("/employee/leave-request")}
                  className="w-full mt-4"
                  data-testid="button-view-leave-requests"
                >
                  <FileText className="w-4 h-4 ml-2" />
                  {t('employee.view_leave_requests')}
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-primary text-right flex items-center gap-2 flex-wrap">
                <Sparkles className="w-5 h-5" />
                {t('employee.important_info')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-right space-y-2">
              <p className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 bg-primary rounded-full" />
                {t('employee.tip_1')}
              </p>
              <p className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 bg-green-500 rounded-full" />
                {t('employee.tip_2')}
              </p>
              <p className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 bg-blue-500 rounded-full" />
                {t('employee.tip_3')}
              </p>
              <p className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 bg-purple-500 rounded-full" />
                {t('employee.tip_4')}
              </p>
              <p className="flex items-center gap-2 flex-wrap">
                <span className="w-2 h-2 bg-primary rounded-full" />
                {t('employee.tip_5')}
              </p>
            </CardContent>
          </Card>
        </div>
            </div>
          </div>
        </div>
      </main>
      <MobileBottomNav employeeRole={employee?.role} onLogout={handleLogout} />
    </div>
  );
}
