import { useState, useEffect, useRef } from "react";
import { useTranslate } from "@/lib/useTranslate";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import QRCodeComponent from "@/components/qr-code";
import chefsplaceLogo from "@assets/blackrose-logo.png";
import {
  Tv, Grid3X3, Star, ArrowLeft, ChevronLeft, ChevronRight,
  Pause, Play, Layers, Sparkles, Coffee
} from "lucide-react";

interface CoffeeItem {
  id: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr?: string;
  description?: string;
  price: string | number;
  oldPrice?: string | null;
  category?: string;
  categoryId?: string;
  imageUrl: string | null;
  isAvailable?: number | boolean;
  isActive?: number | boolean;
}

type Mode = "portrait" | "grid" | "showcase";

export default function MenuView() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>("portrait");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [fade, setFade] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const SLIDE_DURATION = 6000; // ms

  const { data: allItems = [], isLoading } = useQuery<CoffeeItem[]>({
    queryKey: ["/api/coffee-items"],
  });
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/menu-categories"],
  });

  const items = allItems.filter(
    (it) => it.isAvailable !== false && it.isAvailable !== 0 && it.isActive !== false && it.isActive !== 0
  );

  function getCategoryName(item: CoffeeItem) {
    const lookup = item.categoryId || item.category || "";
    const cat = categories.find(
      (c: any) => c.id === lookup || c._id === lookup
    );
    return cat?.nameAr || "";
  }

  const current = items[currentIndex] || null;

  function clearTimers() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  }

  function startTimers() {
    clearTimers();
    setProgress(0);
    if (!isPlaying || items.length <= 1) return;

    let elapsed = 0;
    progressRef.current = setInterval(() => {
      elapsed += 50;
      setProgress((elapsed / SLIDE_DURATION) * 100);
    }, 50);

    intervalRef.current = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex((p) => (p + 1) % items.length);
        setFade(true);
        elapsed = 0;
        setProgress(0);
      }, 400);
    }, SLIDE_DURATION);
  }

  useEffect(() => {
    if (mode === "portrait" && isPlaying) startTimers();
    else clearTimers();
    return clearTimers;
  }, [mode, isPlaying, items.length, currentIndex]);

  function goTo(index: number) {
    clearTimers();
    setFade(false);
    setTimeout(() => {
      setCurrentIndex(index);
      setFade(true);
    }, 200);
    setTimeout(() => startTimers(), 600);
  }

  function prev() { goTo((currentIndex - 1 + items.length) % items.length); }
  function next() { goTo((currentIndex + 1) % items.length); }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-amber-400 text-lg font-medium">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // ─── Portrait TV Mode ────────────────────────────────────────────────
  if (mode === "portrait") {
    return (
      <div className="relative w-full min-h-screen bg-black overflow-hidden select-none" dir="rtl">

        {/* Ambient glow behind image */}
        {current?.imageUrl && (
          <div
            className="absolute inset-0 opacity-30 blur-3xl scale-110 transition-all duration-1000"
            style={{
              backgroundImage: `url(${current.imageUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black" />

        {/* ── Top Bar ── */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-6 pb-2">
          <div className="flex items-center gap-3">
            <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="w-10 h-10 rounded-xl" />
            <div>
              <p className="text-white font-black text-base leading-tight tracking-wide">مكان الشيف البخاري</p>
              <p className="text-amber-400 text-xs font-medium tracking-widest uppercase">قائمة الأطباق</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Controls */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              data-testid="button-play-pause"
            >
              {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={() => setMode("grid")}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              data-testid="button-grid-mode"
            >
              <Grid3X3 className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => setLocation("/menu")}
              className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* ── Progress Bar ── */}
        <div className="relative z-20 mx-6 h-0.5 bg-white/10 rounded-full mt-2">
          <div
            className="h-full bg-gradient-to-l from-amber-400 to-amber-600 rounded-full transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ── Main Hero Image ── */}
        <div className="relative z-10 flex justify-center items-center px-8 mt-6">
          <div
            className="transition-opacity duration-400"
            style={{ opacity: fade ? 1 : 0 }}
          >
            {current?.imageUrl ? (
              <img
                src={current.imageUrl}
                alt={current.nameAr}
                className="w-full max-w-xs mx-auto rounded-3xl shadow-2xl"
                style={{
                  height: "340px",
                  objectFit: "cover",
                  boxShadow: "0 0 60px rgba(0,0,0,0.8), 0 0 30px rgba(251,191,36,0.15)",
                }}
              />
            ) : (
              <div className="w-72 h-72 mx-auto rounded-3xl bg-gradient-to-br from-amber-900/40 to-black flex items-center justify-center">
                <Coffee className="w-24 h-24 text-amber-700/50" />
              </div>
            )}
          </div>
        </div>

        {/* ── Product Info ── */}
        <div
          className="relative z-20 px-8 mt-8 space-y-4 transition-opacity duration-400"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {/* Category badge */}
          {current && getCategoryName(current) && (
            <div className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 rounded-full px-4 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-400 text-xs font-semibold tracking-wider">{getCategoryName(current)}</span>
            </div>
          )}

          {/* Product Name */}
          <h1
            className="text-4xl font-black text-white leading-tight"
            style={{ fontFamily: "'Noto Naskh Arabic', serif", letterSpacing: "-0.5px" }}
          >
            {current?.nameAr}
          </h1>

          {/* Description */}
          {(current?.descriptionAr || current?.description) && (
            <p className="text-white/50 text-sm leading-relaxed line-clamp-2">
              {current.descriptionAr || current.description}
            </p>
          )}

          {/* Price + Stars row */}
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black text-amber-400 leading-none">{current?.price}</span>
              <span className="text-white/40 text-lg font-medium">ر.س</span>
            </div>
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        </div>

        {/* ── Navigation + Dots ── */}
        <div className="relative z-20 px-8 mt-4 flex items-center justify-between">
          <button
            onClick={prev}
            className="w-11 h-11 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-colors"
            data-testid="button-prev"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-1.5">
            {items.slice(0, 12).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 ${
                  i === currentIndex
                    ? "w-6 h-2 bg-amber-400"
                    : "w-2 h-2 bg-white/20 hover:bg-white/40"
                }`}
                data-testid={`dot-${i}`}
              />
            ))}
            {items.length > 12 && (
              <span className="text-white/30 text-xs">+{items.length - 12}</span>
            )}
          </div>

          <button
            onClick={next}
            className="w-11 h-11 bg-white/10 hover:bg-white/20 rounded-2xl flex items-center justify-center transition-colors"
            data-testid="button-next"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* ── QR Code Section ── */}
        <div className="relative z-20 mx-8 mt-6 bg-white/5 border border-white/10 rounded-3xl p-5 flex items-center gap-5">
          <div className="bg-white rounded-2xl p-2 flex-shrink-0">
            <QRCodeComponent
              url={`${window.location.origin}/menu`}
              size="sm"
              title=""
              className="!m-0"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base mb-1">اطلب الآن من هاتفك</p>
            <p className="text-white/40 text-xs leading-relaxed">
              امسح الكود وتصفح قائمتنا الكاملة واطلب وجبتك المفضلة بسهولة
            </p>
            <div className="mt-2 text-amber-400 text-xs font-mono opacity-60">
              {window.location.origin}/menu
            </div>
          </div>
        </div>

        {/* ── Item Counter ── */}
        <div className="relative z-20 text-center mt-4 mb-6">
          <span className="text-white/20 text-xs tracking-widest">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
      </div>
    );
  }

  // ─── Grid Mode ───────────────────────────────────────────────────────
  if (mode === "grid") {
    return (
      <div className="min-h-screen bg-black" dir="rtl">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="w-8 h-8 rounded-lg" />
            <span className="text-white font-black text-sm">مكان الشيف البخاري</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode("portrait")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 rounded-full text-black text-xs font-semibold transition-colors"
              data-testid="button-portrait-mode"
            >
              <Tv className="w-3.5 h-3.5" />
              TV
            </button>
            <button
              onClick={() => setLocation("/menu")}
              className="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="px-4 py-4 columns-2 gap-3 space-y-0">
          {items.map((item, i) => (
            <div
              key={item.id}
              onClick={() => { setCurrentIndex(i); setMode("portrait"); setFade(true); }}
              className="break-inside-avoid mb-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 rounded-2xl overflow-hidden cursor-pointer transition-all active:scale-95"
              data-testid={`card-item-${item.id}`}
            >
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.nameAr}
                  className={`w-full object-cover ${i % 3 === 0 ? "h-44" : "h-32"}`}
                />
              ) : (
                <div className={`w-full bg-gradient-to-br from-amber-900/30 to-black flex items-center justify-center ${i % 3 === 0 ? "h-44" : "h-32"}`}>
                  <Coffee className="w-10 h-10 text-amber-700/40" />
                </div>
              )}
              <div className="p-3">
                <p className="text-white font-bold text-sm leading-tight mb-1">{item.nameAr}</p>
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-black text-base">{item.price}</span>
                  <span className="text-white/30 text-xs">ر.س</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Showcase Mode ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black" dir="rtl">
      <div className="sticky top-0 z-30 bg-black/90 backdrop-blur border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={chefsplaceLogo} alt="مكان الشيف البخاري" className="w-8 h-8 rounded-lg" />
          <span className="text-white font-black text-sm">مكان الشيف البخاري</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("portrait")} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 rounded-full text-black text-xs font-semibold" data-testid="button-portrait">
            <Tv className="w-3.5 h-3.5" />TV
          </button>
          <button onClick={() => setLocation("/menu")} className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center" data-testid="button-back">
            <ArrowLeft className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
      <div className="px-4 py-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3 bg-white/5 border border-white/10 rounded-2xl overflow-hidden" data-testid={`row-item-${item.id}`}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.nameAr} className="w-24 h-24 object-cover flex-shrink-0" />
            ) : (
              <div className="w-24 h-24 bg-gradient-to-br from-amber-900/30 to-black flex items-center justify-center flex-shrink-0">
                <Coffee className="w-8 h-8 text-amber-700/40" />
              </div>
            )}
            <div className="flex-1 p-3 flex flex-col justify-center gap-1">
              <p className="text-white font-bold text-sm leading-tight">{item.nameAr}</p>
              {(item.descriptionAr || item.description) && (
                <p className="text-white/40 text-xs line-clamp-1">{item.descriptionAr || item.description}</p>
              )}
              <div className="flex items-center gap-1">
                <span className="text-amber-400 font-black text-lg">{item.price}</span>
                <span className="text-white/30 text-xs">ر.س</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
