import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Zap, ShoppingCart, ChefHat, Calendar, ClipboardList, X, Search,
  Coffee, BookOpen, Home, EyeOff, Eye, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useTranslate } from "@/lib/useTranslate";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface QuickAction {
  labelAr: string;
  labelEn: string;
  path: string;
  icon: React.ReactNode;
  color: string;
}

const ACTIONS: QuickAction[] = [
  { labelAr: "الرئيسية", labelEn: "Home", path: "/employee/home", icon: <Home className="w-5 h-5" />, color: "bg-foreground text-background" },
  { labelAr: "كاشير", labelEn: "Cashier", path: "/employee/pos", icon: <ShoppingCart className="w-5 h-5" />, color: "bg-primary text-primary-foreground" },
  { labelAr: "المطبخ", labelEn: "Kitchen", path: "/employee/kitchen", icon: <ChefHat className="w-5 h-5" />, color: "bg-orange-500 text-white" },
  { labelAr: "الطلبات", labelEn: "Orders", path: "/employee/orders", icon: <ClipboardList className="w-5 h-5" />, color: "bg-blue-500 text-white" },
  { labelAr: "حضور", labelEn: "Attendance", path: "/employee/attendance", icon: <Calendar className="w-5 h-5" />, color: "bg-emerald-500 text-white" },
  { labelAr: "الطاولات", labelEn: "Tables", path: "/employee/tables", icon: <Coffee className="w-5 h-5" />, color: "bg-amber-500 text-white" },
];

const HIDDEN_KEY = "qirox.quickbar.hidden";

export function QuickActionBar() {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState<boolean>(() => {
    try { return localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
  });
  const tc = useTranslate();
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const staffPath =
    location.startsWith("/employee") ||
    location.startsWith("/manager") ||
    location.startsWith("/admin") ||
    location.startsWith("/owner") ||
    location.startsWith("/executive") ||
    location.startsWith("/driver");

  const hideHere =
    location.includes("/login") ||
    location.includes("/gateway") ||
    location.includes("/activation") ||
    location === "/employee/home" ||
    location.startsWith("/guide") ||
    location.startsWith("/help") ||
    location === "/pos" ||
    location === "/employee/pos" ||
    location === "/employee/cashier" ||
    location.startsWith("/pos/") ||
    location.startsWith("/employee/pos/");

  useEffect(() => { setOpen(false); }, [location]);

  const persistHidden = (v: boolean) => {
    setHidden(v);
    try { localStorage.setItem(HIDDEN_KEY, v ? "1" : "0"); } catch {}
  };

  const openCommand = () => {
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
    );
  };

  if (!staffPath || hideHere) return null;

  // RTL: panel on the LEFT (start side). LTR: panel on the RIGHT.
  const sideClass = isRtl ? "left-0" : "right-0";
  const tabSideClass = isRtl ? "left-0 rounded-r-xl" : "right-0 rounded-l-xl";

  // === HIDDEN MODE: only a tiny "show" tab on the edge ===
  if (hidden) {
    return (
      <button
        onClick={() => persistHidden(false)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-40 w-7 h-16 bg-primary/90 text-primary-foreground shadow-lg flex items-center justify-center hover:w-9 transition-all opacity-50 hover:opacity-100",
          tabSideClass
        )}
        data-testid="quick-action-show"
        aria-label={tc("إظهار شريط الأدوات", "Show toolbar")}
        title={tc("إظهار شريط الأدوات", "Show toolbar")}
      >
        {isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop when panel is open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
          data-testid="quick-action-backdrop"
        />
      )}

      {/* Slide-in panel from the side */}
      <aside
        className={cn(
          "fixed top-0 bottom-0 z-50 w-72 bg-white shadow-2xl border-border transition-transform duration-300 ease-out flex flex-col",
          sideClass,
          isRtl ? "border-r" : "border-l",
          open
            ? "translate-x-0"
            : isRtl ? "-translate-x-full" : "translate-x-full"
        )}
        dir={isRtl ? "rtl" : "ltr"}
        aria-hidden={!open}
        data-testid="quick-action-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-br from-primary/10 to-transparent">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{tc("إجراءات سريعة", "Quick Actions")}</h3>
              <p className="text-[10px] text-muted-foreground">{tc("اختصارات للوصول الفوري", "Instant access shortcuts")}</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg hover:bg-muted transition"
            aria-label={tc("إغلاق", "Close")}
            data-testid="quick-action-close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action list */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-2">
          {ACTIONS.map((a) => {
            const isActive = location === a.path;
            return (
              <button
                key={a.path}
                onClick={() => { setLocation(a.path); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all hover:shadow-md",
                  isActive
                    ? cn(a.color, "shadow-md scale-[1.02]")
                    : "bg-muted/40 hover:bg-muted text-foreground"
                )}
                data-testid={`quick-action-${a.path.split("/").pop()}`}
              >
                <div className={cn(
                  "p-2 rounded-lg flex-shrink-0",
                  isActive ? "bg-white/20" : a.color
                )}>
                  {a.icon}
                </div>
                <span className="font-medium text-sm flex-1 text-start">
                  {tc(a.labelAr, a.labelEn)}
                </span>
              </button>
            );
          })}

          <div className="my-3 border-t border-dashed" />

          <button
            onClick={() => { openCommand(); setOpen(false); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 transition"
            data-testid="quick-action-search"
          >
            <div className="p-2 rounded-lg bg-blue-500 text-white">
              <Search className="w-5 h-5" />
            </div>
            <div className="flex-1 text-start">
              <div className="font-medium text-sm">{tc("بحث موحّد", "Universal Search")}</div>
              <div className="text-[10px] opacity-70">Ctrl+K</div>
            </div>
          </button>

          <button
            onClick={() => { setLocation("/guide"); setOpen(false); }}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 transition"
            data-testid="quick-action-guide"
          >
            <div className="p-2 rounded-lg bg-purple-500 text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <span className="font-medium text-sm flex-1 text-start">
              {tc("دليل النظام", "System Guide")}
            </span>
          </button>
        </nav>

        {/* Footer with hide option */}
        <div className="p-3 border-t bg-muted/20">
          <button
            onClick={() => { persistHidden(true); setOpen(false); }}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-xs text-muted-foreground hover:bg-muted transition"
            data-testid="quick-action-hide"
          >
            <EyeOff className="w-3.5 h-3.5" />
            {tc("إخفاء شريط الأدوات", "Hide toolbar")}
          </button>
          <p className="text-center text-[9px] text-muted-foreground/70 mt-1">
            {tc("يمكنك إظهاره من حافة الشاشة لاحقاً", "You can show it from the screen edge later")}
          </p>
        </div>
      </aside>

      {/* Edge tab — primary trigger (always visible when not hidden) */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-40 w-9 h-20 shadow-xl flex flex-col items-center justify-center gap-1 transition-all hover:w-11",
          tabSideClass,
          open ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
        )}
        data-testid="quick-action-fab"
        aria-label={tc("إجراءات سريعة", "Quick actions")}
      >
        {open ? (
          isRtl ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />
        ) : (
          <>
            <Zap className="w-4 h-4" />
            <span className="text-[8px] font-bold tracking-wider">
              {tc("أدوات", "TOOLS")}
            </span>
          </>
        )}
      </button>
    </>
  );
}
