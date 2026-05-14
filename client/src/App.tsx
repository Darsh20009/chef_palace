import i18n from "@/lib/i18n";
import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Router as WouterRouter, Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthGuard } from "@/components/guards/AuthGuard";
import { AdminLayout } from "@/components/admin-layout";
import { ManagerLayout } from "@/components/manager-layout";
import { CartProvider, useCartStore } from "@/lib/cart-store";
import { CustomerProvider } from "@/contexts/CustomerContext";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { ErrorBoundary } from "@/components/error-boundary";
import { PWAUpdateNotifier } from "@/components/PWAUpdateNotifier";
import { GlobalPrompts } from "@/components/global-prompts";
import { PWAInstallBanner } from "@/components/pwa-install";
import { OfflineIndicator } from "@/components/offline-indicator";
import { CustomerNotificationListener } from "@/components/customer-notification-listener";
import { useProximityNotify } from "@/hooks/useProximityNotify";

const CartModal = lazy(() => import("@/components/cart-modal"));
const CheckoutModal = lazy(() => import("@/components/checkout-modal"));
const CustomerAuthModal = lazy(() => import("@/components/customer-auth-modal"));
const MenuPage = lazy(() => import("@/pages/menu"));
const CustomerProfile = lazy(() => import("@/pages/customer-profile"));
const CartPage = lazy(() => import("@/pages/cart-page"));

const ProductDetails = lazy(() => import("@/pages/product-details"));
const PaymentReturnPage = lazy(() => import("@/pages/payment-return"));
const DeliverySelectionPage = lazy(() => import("@/pages/delivery-selection"));
const DeliveryMapPage = lazy(() => import("@/pages/delivery-map"));
const CheckoutPage = lazy(() => import("@/pages/checkout"));
const OrderTrackingPage = lazy(() => import("@/pages/tracking"));
const PublicOrderTrackPage = lazy(() => import("@/pages/public-order-track"));
const EmployeeGateway = lazy(() => import("@/pages/employee-gateway"));
const EmployeeLogin = lazy(() => import("@/pages/employee-login"));
const EmployeeDashboard = lazy(() => import("@/pages/employee-dashboard"));
const EmployeeCashier = lazy(() => import("@/pages/employee-cashier"));
const EmployeeOrders = lazy(() => import("@/pages/employee-orders"));
const EmployeeLoyalty = lazy(() => import("@/pages/employee-loyalty"));
const EmployeeMenuManagement = lazy(() => import("@/pages/employee-menu-management"));
const EmployeeIngredientsManagement = lazy(() => import("@/pages/employee-ingredients-management"));
const EmployeeOrdersDisplay = lazy(() => import("@/pages/employee-orders-display"));
const UnifiedHub = lazy(() => import("@/pages/unified-hub"));
const MyCard = lazy(() => import("@/pages/my-card"));
const CustomerLogin = lazy(() => import("@/pages/customer-login"));
const CustomerAuth = lazy(() => import("@/pages/CustomerAuth"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const CopyCard = lazy(() => import("@/pages/CopyCard"));
const CardCustomization = lazy(() => import("@/pages/card-customization"));
const MyOrdersPage = lazy(() => import("@/pages/my-orders"));
const MyOffers = lazy(() => import("@/pages/my-offers"));
const ManagerEmployees = lazy(() => import("@/pages/manager-employees"));
const EmployeeActivation = lazy(() => import("@/pages/employee-activation"));
const ManagerDashboard = lazy(() => import("@/pages/manager-dashboard"));
const ManagerLogin = lazy(() => import("@/pages/manager-login"));
const ManagerDrivers = lazy(() => import("@/pages/manager-drivers"));
const ManagerTables = lazy(() => import("@/pages/manager-tables"));
const TableMenu = lazy(() => import("@/pages/table-menu"));
const TableCheckout = lazy(() => import("@/pages/table-checkout"));
const TableOrderTracking = lazy(() => import("@/pages/table-order-tracking"));
const TableReservation = lazy(() => import("@/pages/table-reservation"));
const CashierTableOrders = lazy(() => import("@/pages/cashier-table-orders"));
const CashierTables = lazy(() => import("@/pages/cashier-tables"));
const CashierReservations = lazy(() => import("@/pages/cashier-reservations"));
const EmployeeProductReservations = lazy(() => import("@/pages/employee-product-reservations"));
const EmployeeForgotPassword = lazy(() => import("@/pages/employee-forgot-password"));
const ManagerForgotPassword = lazy(() => import("@/pages/manager-forgot-password"));
const EmployeeAttendance = lazy(() => import("@/pages/employee-attendance"));
const LeaveRequestPage = lazy(() => import("@/pages/leave-request"));
const ManagerAttendance = lazy(() => import("@/pages/manager-attendance"));
const OwnerDashboard = lazy(() => import("@/pages/owner-dashboard"));
const InventoryRawItems = lazy(() => import("@/pages/inventory-raw-items"));
const InventorySuppliers = lazy(() => import("@/pages/inventory-suppliers"));
const InventoryPurchases = lazy(() => import("@/pages/inventory-purchases"));
const InventoryRecipes = lazy(() => import("@/pages/inventory-recipes"));
const InventoryStock = lazy(() => import("@/pages/inventory-stock"));
const InventoryAlerts = lazy(() => import("@/pages/inventory-alerts"));
const InventoryMovements = lazy(() => import("@/pages/inventory-movements"));
const InventoryTransfers = lazy(() => import("@/pages/inventory-transfers"));
const POSSystem = lazy(() => import("@/pages/pos-system"));
const ShiftManagement = lazy(() => import("@/pages/shift-management"));
const KitchenDisplay = lazy(() => import("@/pages/kitchen-display"));
const AccountingDashboard = lazy(() => import("@/pages/accounting-dashboard"));
const OrderStatusDisplay = lazy(() => import("@/pages/order-status-display"));
const CustomerDisplay = lazy(() => import("@/pages/customer-display"));
const InventorySmartPage = lazy(() => import("@/pages/inventory-smart"));
const EmployeeAvailability = lazy(() => import("@/pages/employee-availability"));
const UnauthorizedPage = lazy(() => import("@/pages/unauthorized"));
const ProductReviews = lazy(() => import("@/pages/product-reviews"));
const ReferralProgram = lazy(() => import("@/pages/referral-program"));
const NotificationsPage = lazy(() => import("@/pages/notifications"));
const AdminNotificationsPage = lazy(() => import("@/pages/admin-notifications"));
const CustomerReservations = lazy(() => import("@/pages/customer-reservations"));
const AdminDashboard = lazy(() => import("@/pages/admin-dashboard"));
const AdminEmployees = lazy(() => import("@/pages/admin-employees"));
const AdminReports = lazy(() => import("@/pages/admin-reports"));
const AdminSettings = lazy(() => import("@/pages/admin-settings"));
const AdminBranches = lazy(() => import("@/pages/admin-branches"));
const AdminEmail = lazy(() => import("@/pages/admin-email"));
const TenantSignup = lazy(() => import("@/pages/tenant-signup"));
const NotFound = lazy(() => import("@/pages/not-found"));
const PrivacyPolicy = lazy(() => import("@/pages/privacy-policy"));
const ExecutiveDashboard = lazy(() => import("@/pages/executive-dashboard"));
const ZATCAInvoices = lazy(() => import("@/pages/zatca-invoices"));
const MenuView = lazy(() => import("@/pages/menu-view"));
const ErpAccountingPage = lazy(() => import("@/pages/erp-accounting"));
const UserGuide = lazy(() => import("@/pages/user-guide"));
const AdvancedAnalytics = lazy(() => import("@/pages/advanced-analytics"));
const UnifiedReports = lazy(() => import("@/pages/unified-reports"));
const BIAnalytics = lazy(() => import("@/pages/bi-analytics"));
const ManagerAI = lazy(() => import("@/pages/manager-ai"));
const GiftCardsManagement = lazy(() => import("@/pages/gift-cards-management"));
const PromotionsManagement = lazy(() => import("@/pages/promotions-management"));
const ApiManagement = lazy(() => import("@/pages/api-management"));
const KioskPage = lazy(() => import("@/pages/kiosk"));
const PayrollManagement = lazy(() => import("@/pages/payroll-management"));
const ManagerReviews = lazy(() => import("@/pages/manager-reviews"));
const SupplierManagement = lazy(() => import("@/pages/supplier-management"));
const LoyaltyProgram = lazy(() => import("@/pages/loyalty-program"));
const ExternalIntegrations = lazy(() => import("@/pages/external-integrations"));
const WarehouseManagement = lazy(() => import("@/pages/warehouse-management"));
const SupportSystem = lazy(() => import("@/pages/support-system"));
const StockOrganizationDashboard = lazy(() => import("@/pages/stock-organization-dashboard"));
const DeliveryServiceStatus = lazy(() => import("@/pages/delivery-service-status"));
const ManagerDelivery = lazy(() => import("@/pages/manager-delivery"));
const DriverPortal = lazy(() => import("@/pages/driver-portal"));
const DriverLogin = lazy(() => import("@/pages/driver-login"));
const DeliveryTracking = lazy(() => import("@/pages/delivery-tracking"));
const WelcomePage = lazy(() => import("@/pages/welcome"));
const SplashScreen = lazy(() => import("@/pages/splash"));
const PromoPage = lazy(() => import("@/pages/promo"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const EmployeeHome = lazy(() => import("@/pages/employee-home"));
const QiroxLogin = lazy(() => import("@/pages/qirox-login"));
const QiroxDashboard = lazy(() => import("@/pages/qirox-dashboard"));
const HardwareManagement = lazy(() => import("@/pages/hardware-management"));
const EthernetPrinterSetup = lazy(() => import("@/pages/ethernet-printer-setup"));
const B2BMarketplace = lazy(() => import("@/pages/b2b-marketplace"));
const PartnerProgram = lazy(() => import("@/pages/partner-program"));
const DriveThroughPage = lazy(() => import("@/pages/drive-through"));
const chefsplaceLogo = "/logo.png";
const chefsplaceLogoStaff = "/logo.png";

const PageLoader = () => null;

const MaintenancePage = lazy(() => import("@/pages/maintenance"));

function RouterFallback() {
  const path = window.location.pathname;
  const isStaffPath = path.startsWith('/employee') || path.startsWith('/manager') || path.startsWith('/admin') || path.startsWith('/driver') || path.startsWith('/qirox');
  if (isStaffPath) return <NotFound />;
  return <MenuPage />;
}

function AppRouter() {
  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  if (businessConfig?.isMaintenanceMode && !window.location.pathname.startsWith('/employee') && !window.location.pathname.startsWith('/manager') && !window.location.pathname.startsWith('/admin')) {
    return <MaintenancePage reason={businessConfig.maintenanceReason} />;
  }

  return (
    <Switch>
      {/* QIROX Super Admin */}
      <Route path="/qirox/dashboard"><QiroxDashboard /></Route>
      <Route path="/qirox"><QiroxLogin /></Route>
      
      {/* Public routes */}
      <Route path="/welcome"><WelcomePage /></Route>
      <Route path="/splash"><SplashScreen /></Route>
      <Route path="/promo/:code"><PromoPage /></Route>
      <Route path="/pricing"><PricingPage /></Route>
      <Route path="/privacy"><PrivacyPolicy /></Route>
      <Route path="/" component={SplashScreen} />
      <Route path="/0">{() => { window.location.replace('/employee/login'); return null; }}</Route>
      <Route path="/tenant/signup"><TenantSignup /></Route>
      <Route path="/customer-login">
        <CustomerLogin />
      </Route>
      <Route path="/auth">
        <CustomerAuth />
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      <Route path="/menu">
        <MenuPage />
      </Route>
      <Route path="/menu-view">
        <MenuView />
      </Route>
      <Route path="/product/:id">
        <ProductDetails />
      </Route>
      <Route path="/table-menu/:qrToken">
        <TableMenu />
      </Route>
      <Route path="/table-checkout/:tableId/:tableNumber">
        <TableCheckout />
      </Route>
      <Route path="/table-reservation">
        <TableReservation />
      </Route>
      <Route path="/my-reservations">
        <CustomerReservations />
      </Route>
      <Route path="/table-order-tracking/:orderId">
        <TableOrderTracking />
      </Route>
      <Route path="/order-status">
        <OrderStatusDisplay />
      </Route>
      <Route path="/track/:orderNumber">
        <PublicOrderTrackPage />
      </Route>
      <Route path="/customer-display">
        <CustomerDisplay />
      </Route>
      <Route path="/unauthorized">
        <UnauthorizedPage />
      </Route>

      {/* Notifications - for all users */}
      <Route path="/notifications"><NotificationsPage /></Route>
      <Route path="/admin/notifications"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminNotificationsPage /></AdminLayout></AuthGuard></Route>

      {/* Customer protected routes */}
      <Route path="/copy-card"><AuthGuard userType="customer"><CopyCard /></AuthGuard></Route>
      <Route path="/card-customization"><AuthGuard userType="customer"><CardCustomization /></AuthGuard></Route>
      <Route path="/my-orders"><AuthGuard userType="customer"><MyOrdersPage /></AuthGuard></Route>
      <Route path="/my-offers"><AuthGuard userType="customer"><MyOffers /></AuthGuard></Route>
      <Route path="/my-card"><AuthGuard userType="customer"><MyCard /></AuthGuard></Route>
      <Route path="/referrals"><AuthGuard userType="customer"><ReferralProgram /></AuthGuard></Route>
      <Route path="/cart"><CartPage /></Route>
      <Route path="/delivery"><AuthGuard userType="customer"><DeliverySelectionPage /></AuthGuard></Route>
      <Route path="/delivery/map"><AuthGuard userType="customer"><DeliveryMapPage /></AuthGuard></Route>
      <Route path="/checkout"><AuthGuard userType="customer"><CheckoutPage /></AuthGuard></Route>
      <Route path="/tracking"><AuthGuard userType="customer"><OrderTrackingPage /></AuthGuard></Route>
      <Route path="/payment-return"><PaymentReturnPage /></Route>
      <Route path="/profile"><AuthGuard userType="customer"><CustomerProfile /></AuthGuard></Route>

      {/* Employee auth routes (public) */}
      <Route path="/employee">{() => { window.location.replace('/employee/login'); return null; }}</Route>
      <Route path="/employee/home">{() => <AuthGuard userType="employee"><EmployeeHome /></AuthGuard>}</Route>
      <Route path="/employee/gateway"><EmployeeGateway /></Route>
      <Route path="/employee/login"><EmployeeLogin /></Route>
      <Route path="/employee/forgot-password"><EmployeeForgotPassword /></Route>
      <Route path="/employee/activate"><EmployeeActivation /></Route>

      {/* Employee protected routes */}
      <Route path="/employee/dashboard"><AuthGuard userType="employee"><EmployeeDashboard /></AuthGuard></Route>
      <Route path="/employee/cashier"><AuthGuard userType="employee"><EmployeeCashier /></AuthGuard></Route>
      <Route path="/employee/pos"><AuthGuard userType="employee"><POSSystem /></AuthGuard></Route>
      <Route path="/employee/shifts"><AuthGuard userType="employee"><ShiftManagement /></AuthGuard></Route>
      <Route path="/employee/kitchen"><AuthGuard userType="employee"><KitchenDisplay /></AuthGuard></Route>
      <Route path="/employee/tables"><AuthGuard userType="employee"><CashierTables /></AuthGuard></Route>
      <Route path="/employee/table-orders"><AuthGuard userType="employee"><CashierTableOrders /></AuthGuard></Route>
      <Route path="/employee/orders"><AuthGuard userType="employee"><EmployeeOrders /></AuthGuard></Route>
      <Route path="/manager/orders"><AuthGuard userType="manager" allowedRoles={["manager", "admin", "owner"]}><ManagerLayout><EmployeeOrders /></ManagerLayout></AuthGuard></Route>
      <Route path="/employee/orders-display"><AuthGuard userType="employee"><EmployeeOrdersDisplay /></AuthGuard></Route>
      <Route path="/employee/loyalty"><AuthGuard userType="employee"><EmployeeLoyalty /></AuthGuard></Route>
      <Route path="/employee/menu-management"><AuthGuard userType="manager" allowedRoles={["manager", "admin", "owner"]}><ManagerLayout><EmployeeMenuManagement /></ManagerLayout></AuthGuard></Route>
      <Route path="/employee/ingredients"><AuthGuard userType="employee" allowedRoles={["manager", "admin"]}><EmployeeIngredientsManagement /></AuthGuard></Route>
      <Route path="/employee/availability"><AuthGuard userType="employee"><EmployeeAvailability /></AuthGuard></Route>
      <Route path="/employee/attendance"><AuthGuard userType="employee"><EmployeeAttendance /></AuthGuard></Route>
      <Route path="/employee/leave-request"><AuthGuard userType="employee"><LeaveRequestPage /></AuthGuard></Route>
      <Route path="/employee/reservations"><AuthGuard userType="employee"><CashierReservations /></AuthGuard></Route>
      <Route path="/manager/reservations"><AuthGuard userType="manager" allowedRoles={["manager", "admin", "owner"]}><ManagerLayout><CashierReservations /></ManagerLayout></AuthGuard></Route>
      <Route path="/employee/product-reservations"><AuthGuard userType="employee"><EmployeeProductReservations /></AuthGuard></Route>
      <Route path="/manager/product-reservations"><AuthGuard userType="manager" allowedRoles={["manager", "admin", "owner"]}><ManagerLayout><EmployeeProductReservations /></ManagerLayout></AuthGuard></Route>

      {/* Manager auth routes (public) */}
      <Route path="/manager"><ManagerLogin /></Route>
      <Route path="/manager/forgot-password"><ManagerForgotPassword /></Route>
      <Route path="/manager/login"><ManagerLogin /></Route>

      {/* Manager protected routes */}
      <Route path="/manager/employees"><AuthGuard userType="employee" allowedRoles={["manager", "admin", "owner"]}><ManagerEmployees /></AuthGuard></Route>
      <Route path="/manager/drivers"><AuthGuard userType="manager"><ManagerDrivers /></AuthGuard></Route>
      <Route path="/manager/dashboard"><AuthGuard userType="manager"><ManagerDashboard /></AuthGuard></Route>
      <Route path="/manager/tables"><AuthGuard userType="manager"><ManagerTables /></AuthGuard></Route>
      <Route path="/manager/attendance"><AuthGuard userType="manager"><ManagerAttendance /></AuthGuard></Route>
      <Route path="/manager/inventory"><AuthGuard userType="manager"><InventorySmartPage /></AuthGuard></Route>
      <Route path="/manager/inventory/raw-items"><AuthGuard userType="manager"><InventoryRawItems /></AuthGuard></Route>
      <Route path="/manager/inventory/suppliers"><AuthGuard userType="manager"><InventorySuppliers /></AuthGuard></Route>
      <Route path="/manager/inventory/purchases"><AuthGuard userType="manager"><InventoryPurchases /></AuthGuard></Route>
      <Route path="/manager/inventory/recipes"><AuthGuard userType="manager"><InventoryRecipes /></AuthGuard></Route>
      <Route path="/manager/inventory/stock"><AuthGuard userType="manager"><InventoryStock /></AuthGuard></Route>
      <Route path="/manager/inventory/alerts"><AuthGuard userType="manager"><InventoryAlerts /></AuthGuard></Route>
      <Route path="/manager/inventory/movements"><AuthGuard userType="manager"><InventoryMovements /></AuthGuard></Route>
      <Route path="/manager/inventory/transfers"><AuthGuard userType="manager"><InventoryTransfers /></AuthGuard></Route>
      <Route path="/manager/accounting"><AuthGuard userType="manager"><AccountingDashboard /></AuthGuard></Route>
      <Route path="/manager/shifts"><AuthGuard userType="manager"><ShiftManagement /></AuthGuard></Route>
      <Route path="/manager/zatca"><AuthGuard userType="manager"><ZATCAInvoices /></AuthGuard></Route>
      <Route path="/manager/guide"><AuthGuard userType="manager"><UserGuide /></AuthGuard></Route>
      <Route path="/guide"><UserGuide /></Route>
      <Route path="/manager/analytics"><AuthGuard userType="manager"><AdvancedAnalytics /></AuthGuard></Route>
      <Route path="/manager/gift-cards"><AuthGuard userType="manager"><GiftCardsManagement /></AuthGuard></Route>
      <Route path="/manager/promotions"><AuthGuard userType="manager"><PromotionsManagement /></AuthGuard></Route>
      <Route path="/admin/api"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><ApiManagement /></AdminLayout></AuthGuard></Route>
      <Route path="/kiosk"><KioskPage /></Route>
      <Route path="/manager/payroll"><AuthGuard userType="manager"><PayrollManagement /></AuthGuard></Route>
      <Route path="/manager/reviews"><AuthGuard userType="manager"><ManagerReviews /></AuthGuard></Route>
      <Route path="/manager/suppliers"><AuthGuard userType="manager"><SupplierManagement /></AuthGuard></Route>
      <Route path="/manager/loyalty"><AuthGuard userType="manager"><LoyaltyProgram /></AuthGuard></Route>
      <Route path="/manager/integrations"><AuthGuard userType="manager"><ExternalIntegrations /></AuthGuard></Route>
      <Route path="/manager/warehouse"><AuthGuard userType="manager"><WarehouseManagement /></AuthGuard></Route>
      <Route path="/manager/support"><AuthGuard userType="manager"><SupportSystem /></AuthGuard></Route>
      <Route path="/manager/inventory/stock-organization"><AuthGuard userType="manager"><StockOrganizationDashboard /></AuthGuard></Route>
      <Route path="/manager/delivery-services"><AuthGuard userType="manager"><DeliveryServiceStatus /></AuthGuard></Route>
      <Route path="/manager/delivery"><AuthGuard userType="manager"><ManagerDelivery /></AuthGuard></Route>
      <Route path="/manager/unified-reports"><AuthGuard userType="manager"><UnifiedReports /></AuthGuard></Route>
      <Route path="/manager/bi-analytics"><AuthGuard userType="manager"><BIAnalytics /></AuthGuard></Route>
      <Route path="/manager/ai"><AuthGuard userType="manager"><ManagerAI /></AuthGuard></Route>
      {/* Owner protected routes */}
      <Route path="/owner/dashboard"><AuthGuard userType="manager" allowedRoles={["owner", "admin"]}><OwnerDashboard /></AuthGuard></Route>
      <Route path="/executive"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><ExecutiveDashboard /></AuthGuard></Route>

      {/* Admin redirect */}
      <Route path="/admin"><Redirect to="/admin/dashboard" /></Route>

      {/* Admin protected routes */}
      <Route path="/admin/dashboard"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminDashboard /></AuthGuard></Route>
      <Route path="/admin/employees"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminEmployees /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/reports"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminReports /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/settings"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminSettings /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/branches"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminBranches /></AdminLayout></AuthGuard></Route>
      <Route path="/admin/email"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><AdminLayout><AdminEmail /></AdminLayout></AuthGuard></Route>

      {/* ERP Accounting System */}
      <Route path="/erp/accounting"><AuthGuard userType="manager" allowedRoles={["owner", "admin", "manager"]}><ErpAccountingPage /></AuthGuard></Route>


      {/* Hardware, B2B & Partner routes */}
      <Route path="/manager/hardware"><AuthGuard userType="manager"><HardwareManagement /></AuthGuard></Route>
      <Route path="/manager/printer-setup"><AuthGuard userType="manager"><EthernetPrinterSetup /></AuthGuard></Route>
      <Route path="/manager/b2b"><AuthGuard userType="manager"><B2BMarketplace /></AuthGuard></Route>
      <Route path="/manager/partners"><AuthGuard userType="manager"><PartnerProgram /></AuthGuard></Route>

      {/* Drive-Through Menu */}
      <Route path="/drive-through"><DriveThroughPage /></Route>

      {/* Driver Portal routes */}
      <Route path="/driver/login"><DriverLogin /></Route>
      <Route path="/driver/portal"><DriverPortal /></Route>

      {/* Customer Delivery Tracking */}
      <Route path="/delivery/track/:orderId"><DeliveryTracking /></Route>
      <Route component={RouterFallback} />
    </Switch>
  );
}

function AppContent() {
  const cartStore = useCartStore();
  const isCartOpen = cartStore?.isCartOpen;
  const isCheckoutOpen = cartStore?.isCheckoutOpen;

  // Proximity-based push notification (fires when customer is within 100 m of a branch)
  useProximityNotify();

  return (
    <>
      {/* Silent real-time notification listener for logged-in customers */}
      <CustomerNotificationListener />
      <Suspense fallback={<PageLoader />}>
        <AppRouter />
      </Suspense>
      {/* Modals inside Router to ensure they can use routing hooks if needed */}
      <Suspense fallback={null}>
        {isCartOpen && <CartModal />}
        {isCheckoutOpen && <CheckoutModal />}
        <CustomerAuthModal />
      </Suspense>
      <Toaster />
    </>
  );
}

function App() {
  const [isEmployee, setIsEmployee] = useState(false);
  const [lang, setLang] = useState(i18n.language || 'ar');

  useEffect(() => {
    const onLangChanged = (lng: string) => setLang(lng);
    i18n.on('languageChanged', onLangChanged);
    return () => { i18n.off('languageChanged', onLangChanged); };
  }, []);

  useEffect(() => {
    // Prefetch critical data in parallel on app start so pages load instantly
    const prefetch = (url: string) =>
      queryClient.prefetchQuery({ queryKey: [url], staleTime: 5 * 60 * 1000 });
    Promise.all([
      prefetch("/api/business-config"),
      prefetch("/api/coffee-items"),
      prefetch("/api/menu-categories"),
      prefetch("/api/product-addons"),
      prefetch("/api/custom-banners"),
      prefetch("/api/payment-methods"),
      prefetch("/api/public/loyalty-settings"),
    ]);
  }, []);

  useEffect(() => {
    const employeePaths = ['/employee', '/manager', '/kitchen', '/pos', '/cashier', '/admin', '/owner', '/executive', '/0'];
    const currentPath = window.location.pathname;
    const isEmployeePath = employeePaths.some(path => currentPath === path || currentPath.startsWith(path + '/'));
    setIsEmployee(isEmployeePath);

    const manifestTag = document.getElementById('main-manifest') as HTMLLinkElement;
    if (manifestTag) {
      manifestTag.href = isEmployeePath ? '/employee-manifest.json' : '/manifest.json';
    }

    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;

    if (isEmployeePath && currentPath === '/') {
      window.location.href = '/employee';
    }
  }, [lang]);

  return (
    <div className={`${isEmployee ? 'employee-portal' : 'customer-portal'} min-h-screen bg-background text-foreground font-ibm-arabic antialiased`} dir={lang === 'ar' ? 'rtl' : 'ltr'} key={lang}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CustomerProvider>
            <AuthModalProvider>
            <CartProvider>
              <ErrorBoundary>
                <WouterRouter>
                  <AppContent />
                </WouterRouter>
                <GlobalPrompts />
                <PWAUpdateNotifier />
                <PWAInstallBanner />
                <OfflineIndicator />
              </ErrorBoundary>
            </CartProvider>
            </AuthModalProvider>
          </CustomerProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
