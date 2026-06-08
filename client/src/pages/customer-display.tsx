import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRealtimeEvent } from "@/hooks/useRealtimeEngine";
import type { CoffeeItem } from "@shared/schema";
import qiroxLogo from "@assets/qirox-logo-customer.png";
import { useTranslate } from "@/lib/useTranslate";

type DisplayMode = "idle" | "order-review" | "payment-processing" | "payment-success";

interface CartItem {
  nameAr: string;
  price: number;
  quantity: number;
  lineItemId?: string;
}

interface DisplayState {
  mode: DisplayMode;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  orderNumber?: string;
  lastAdded?: string;
}

const IDLE_STATE: DisplayState = {
  mode: "idle",
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
};

function useQRCode(url: string) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    import("qrcode").then((QRCode) => {
      QRCode.default.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: "#ffffff", light: "#0a1628" },
      }).then(setQrDataUrl).catch(() => {});
    });
  }, [url]);
  return qrDataUrl;
}

export default function CustomerDisplay() {
  const [state, setState] = useState<DisplayState>(IDLE_STATE);
  const [highlightedItem, setHighlightedItem] = useState<string | null>(null);
  const [stripIndex, setStripIndex] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tc = useTranslate();

  const siteUrl = window.location.origin;
  const qrDataUrl = useQRCode(siteUrl);

  const { data: businessConfig } = useQuery<any>({
    queryKey: ["/api/business-config"],
  });

  const { data: products = [] } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });

  const stripProducts = (products as CoffeeItem[]).slice(0, 30);

  const setIdle = useCallback(() => {
    setState(IDLE_STATE);
    setHighlightedItem(null);
  }, []);

  const scheduleIdle = useCallback((delayMs: number) => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(setIdle, delayMs);
  }, [setIdle]);

  const handlePosUpdate = useCallback((payload: any) => {
    if (!payload) return;
    const { event, items, subtotal, tax, total, orderNumber, lastAdded } = payload;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

    switch (event) {
      case "order_started":
        setState({ mode: "order-review", items: items || [], subtotal: subtotal || 0, tax: tax || 0, total: total || 0 });
        if (lastAdded) {
          setHighlightedItem(lastAdded);
          highlightTimerRef.current = setTimeout(() => setHighlightedItem(null), 1500);
        }
        break;
      case "item_added":
      case "item_updated":
        setState(prev => ({ ...prev, mode: "order-review", items: items || [], subtotal: subtotal || 0, tax: tax || 0, total: total || 0 }));
        if (lastAdded) {
          setHighlightedItem(lastAdded);
          highlightTimerRef.current = setTimeout(() => setHighlightedItem(null), 1500);
        }
        break;
      case "order_cancelled":
        setState(IDLE_STATE);
        break;
      case "payment_processing":
        setState(prev => ({ ...prev, mode: "payment-processing", items: items || prev.items, subtotal: subtotal || prev.subtotal, tax: tax || prev.tax, total: total || prev.total }));
        break;
      case "payment_success":
        setState(prev => ({ ...prev, mode: "payment-success", orderNumber, items: items || prev.items, subtotal: subtotal || prev.subtotal, tax: tax || prev.tax, total: total || prev.total }));
        scheduleIdle(5000);
        break;
    }
  }, [scheduleIdle]);

  useRealtimeEvent("pos_cart_update", (msg: any) => handlePosUpdate(msg?.payload ?? msg));

  useEffect(() => {
    if (stripProducts.length === 0) return;
    const interval = setInterval(() => {
      setStripIndex(prev => (prev + 1) % stripProducts.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [stripProducts.length]);

  useEffect(() => {
    if (stripProducts.length === 0 || !stripRef.current) return;
    const children = stripRef.current.children;
    if (children[stripIndex]) {
      (children[stripIndex] as HTMLElement).scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [stripIndex, stripProducts.length]);

  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (e.key === "F5" || (e.key === "r" && e.ctrlKey)) e.preventDefault();
    };
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("keydown", preventKeys);
    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("keydown", preventKeys);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  const branchName = businessConfig?.tradeNameAr || businessConfig?.tradeNameEn || "مكان الشيف البخاري";
  const formatPrice = (n: number) => `${n.toFixed(2)} ${tc("ر.س", "SAR")}`;

  return (
    <div
      className="fixed inset-0 bg-[#0a0a0a] text-white overflow-hidden select-none"
      style={{ cursor: "none", direction: "rtl" }}
    >
      {state.mode === "idle" && (
        <IdleScreen
          branchName={branchName}
          qrDataUrl={qrDataUrl}
          siteUrl={siteUrl}
          products={stripProducts}
          stripRef={stripRef}
          tc={tc}
        />
      )}
      {state.mode === "order-review" && (
        <OrderReviewScreen
          state={state}
          highlightedItem={highlightedItem}
          branchName={branchName}
          products={stripProducts}
          stripRef={stripRef}
          formatPrice={formatPrice}
          tc={tc}
        />
      )}
      {state.mode === "payment-processing" && (
        <PaymentProcessingScreen state={state} formatPrice={formatPrice} tc={tc} />
      )}
      {state.mode === "payment-success" && (
        <PaymentSuccessScreen state={state} formatPrice={formatPrice} tc={tc} />
      )}
    </div>
  );
}

function IdleScreen({
  branchName,
  qrDataUrl,
  siteUrl,
  products,
  stripRef,
  tc,
}: {
  branchName: string;
  qrDataUrl: string | null;
  siteUrl: string;
  products: any[];
  stripRef: React.RefObject<HTMLDivElement>;
  tc: (ar: string, en: string) => string;
}) {
  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-16 py-10 relative">
        <div className="flex flex-col items-center gap-5">
          <img
            src={qiroxLogo}
            alt="Logo"
            className="w-44 h-44 object-contain rounded-2xl shadow-2xl"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="text-center">
            <h1 className="text-6xl font-black tracking-wide text-white mb-2">{branchName}</h1>
            <div className="w-28 h-1 bg-[#2D9B6E] mx-auto rounded-full" />
          </div>
        </div>

        <div className="text-center mt-2">
          <p className="text-2xl text-gray-400 font-light">{tc("أهلاً وسهلاً بكم", "Welcome")}</p>
          <p className="text-lg text-gray-500 mt-1">{tc("في انتظار طلبكم", "Awaiting your order")}</p>
        </div>

        <div className="flex flex-col items-center gap-3 mt-4 bg-[#141414] rounded-3xl px-8 py-6 border border-[#2a2a2a]">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR" className="w-36 h-36 rounded-xl" />
          ) : (
            <div className="w-36 h-36 bg-[#1a1a1a] rounded-xl animate-pulse" />
          )}
          <p className="text-gray-400 text-sm text-center">{tc("امسح الباركود لزيارة موقعنا", "Scan to visit our website")}</p>
          <p className="text-[#2D9B6E] text-xs font-mono">{siteUrl.replace(/^https?:\/\//, "")}</p>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
          <ClockDisplay />
        </div>
      </div>

      <ProductStrip products={products} stripRef={stripRef} />
    </div>
  );
}

function OrderReviewScreen({
  state,
  highlightedItem,
  branchName,
  products,
  stripRef,
  formatPrice,
  tc,
}: {
  state: DisplayState;
  highlightedItem: string | null;
  branchName: string;
  products: any[];
  stripRef: React.RefObject<HTMLDivElement>;
  formatPrice: (n: number) => string;
  tc: (ar: string, en: string) => string;
}) {
  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col h-full">
        <div className="bg-[#141414] px-8 py-4 flex items-center justify-between border-b border-[#2a2a2a]">
          <div className="flex items-center gap-4">
            <img
              src={qiroxLogo}
              alt="Logo"
              className="w-10 h-10 object-contain rounded-lg"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <h2 className="text-2xl font-bold text-white">{branchName}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#2D9B6E] rounded-full animate-pulse" />
            <span className="text-gray-400 text-sm">{tc("طلب جارٍ", "Order in progress")}</span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-8 py-4">
          <div className="h-full overflow-y-auto space-y-3 pl-2" style={{ scrollbarWidth: "none" }}>
            {state.items.map((item, idx) => (
              <div
                key={item.lineItemId || idx}
                className={`flex items-center justify-between rounded-2xl px-6 py-4 transition-all duration-500 ${
                  highlightedItem === item.nameAr
                    ? "bg-[#2D9B6E] scale-[1.02] shadow-lg shadow-[#2D9B6E]/30"
                    : "bg-[#1a1a1a]"
                }`}
                data-testid={`display-item-${idx}`}
              >
                <div className="flex items-center gap-4">
                  <span className="text-3xl font-black text-[#2D9B6E] w-10 text-center">{item.quantity}×</span>
                  <span className="text-xl font-semibold text-white">{item.nameAr}</span>
                  {highlightedItem === item.nameAr && (
                    <span className="bg-white text-[#2D9B6E] text-xs font-bold px-2 py-0.5 rounded-full animate-bounce">
                      {tc("جديد", "New")}
                    </span>
                  )}
                </div>
                <span className="text-xl font-bold text-gray-300">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#141414] border-t border-[#2a2a2a] px-8 py-5">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-400 text-lg">{tc("المجموع قبل الضريبة", "Subtotal before tax")}</span>
            <span className="text-gray-300 text-lg">{formatPrice(state.subtotal)}</span>
          </div>
          <div className="flex justify-between items-center mb-4">
            <span className="text-gray-400 text-lg">{tc("ضريبة القيمة المضافة (15%)", "VAT (15%)")}</span>
            <span className="text-gray-300 text-lg">{formatPrice(state.tax)}</span>
          </div>
          <div className="flex justify-between items-center bg-[#2D9B6E] rounded-2xl px-6 py-4">
            <span className="text-white text-3xl font-bold">{tc("الإجمالي", "Total")}</span>
            <span className="text-white text-4xl font-black">{formatPrice(state.total)}</span>
          </div>
        </div>
      </div>

      <ProductStrip products={products} stripRef={stripRef} />
    </div>
  );
}

function PaymentProcessingScreen({ state, formatPrice, tc }: { state: DisplayState; formatPrice: (n: number) => string; tc: (ar: string, en: string) => string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 bg-[#0a0a0a]">
      <img
        src={qiroxLogo}
        alt="Logo"
        className="w-20 h-20 object-contain rounded-xl opacity-60"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="relative">
        <div className="w-40 h-40 rounded-full border-4 border-[#2D9B6E]/30 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#2D9B6E] animate-spin" />
          <span className="text-5xl">💳</span>
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-5xl font-black text-white mb-4">{tc("جاري الدفع...", "Processing Payment...")}</h2>
        <p className="text-2xl text-gray-400">{tc("يرجى الانتظار", "Please wait")}</p>
      </div>
      <div className="bg-[#141414] rounded-2xl px-12 py-5 text-center">
        <span className="text-gray-400 text-xl">{tc("الإجمالي: ", "Total: ")}</span>
        <span className="text-[#2D9B6E] text-3xl font-black">{formatPrice(state.total)}</span>
      </div>
    </div>
  );
}

function PaymentSuccessScreen({ state, formatPrice, tc }: { state: DisplayState; formatPrice: (n: number) => string; tc: (ar: string, en: string) => string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 bg-[#0a0a0a]">
      <img
        src={qiroxLogo}
        alt="Logo"
        className="w-24 h-24 object-contain rounded-xl"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
      <div className="relative animate-bounce">
        <div className="w-36 h-36 rounded-full bg-[#2D9B6E] flex items-center justify-center shadow-2xl shadow-[#2D9B6E]/50">
          <span className="text-6xl font-black text-white">✓</span>
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-6xl font-black text-white mb-4">{tc("تمت العملية بنجاح!", "Payment Successful!")}</h2>
        {state.orderNumber && (
          <div className="bg-[#141414] rounded-2xl px-8 py-3 mt-2 inline-block">
            <span className="text-gray-400 text-xl">{tc("رقم الطلب: ", "Order #: ")}</span>
            <span className="text-[#2D9B6E] text-2xl font-black">{state.orderNumber}</span>
          </div>
        )}
      </div>
      <div className="bg-[#2D9B6E]/20 border border-[#2D9B6E]/40 rounded-2xl px-12 py-5 text-center">
        <span className="text-gray-300 text-xl">{tc("المبلغ المدفوع: ", "Amount paid: ")}</span>
        <span className="text-white text-3xl font-black">{formatPrice(state.total)}</span>
      </div>
      <p className="text-gray-500 text-lg animate-pulse">{tc("شكراً لزيارتكم", "Thank you for visiting")}</p>
    </div>
  );
}

function ProductStrip({ products, stripRef }: { products: any[]; stripRef: React.RefObject<HTMLDivElement> }) {
  if (products.length === 0) return null;
  const doubled = [...products, ...products];
  return (
    <div className="w-32 bg-[#07111e] border-r border-[#2a2a2a] flex flex-col overflow-hidden">
      <div
        ref={stripRef}
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "none", pointerEvents: "none" }}
      >
        {doubled.map((product, idx) => (
          <div key={idx} className="w-full aspect-square p-1.5">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt=""
                className="w-full h-full object-cover rounded-lg opacity-70"
                draggable={false}
              />
            ) : (
              <div className="w-full h-full bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                <span className="text-2xl">☕</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ClockDisplay() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-4xl font-light tabular-nums text-gray-500">
      {time.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
