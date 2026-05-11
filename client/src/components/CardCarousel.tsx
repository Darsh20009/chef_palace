import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LoyaltyCard } from "@shared/schema";
import { brand } from "@/lib/brand";

interface CardCarouselProps {
  cards: LoyaltyCard[];
  activeCard: LoyaltyCard;
  onSelectCard: (card: LoyaltyCard) => void;
}

export default function CardCarousel({ cards, activeCard, onSelectCard }: CardCarouselProps) {
  const [direction, setDirection] = useState(0);

  if (cards.length <= 1) {
    return null;
  }

  const currentIndex = cards.findIndex(c => c.id === activeCard.id);
  const nextIndex = (currentIndex + 1) % cards.length;
  const prevIndex = (currentIndex - 1 + cards.length) % cards.length;

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 1000 : -1000,
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      zIndex: 0,
      x: dir < 0 ? 1000 : -1000,
      opacity: 0,
    }),
  };

  const getDesignColor = (design?: string) => {
    const designs: Record<string, { bg: string; text: string; label: string }> = {
      classic: { bg: "from-amber-600 to-amber-700", text: "text-amber-100", label: "كلاسيكي" },
      modern: { bg: "from-blue-600 to-blue-700", text: "text-blue-100", label: "عصري" },
      dark: { bg: "from-slate-700 to-slate-800", text: "text-slate-100", label: "داكن" },
      gold: { bg: "from-yellow-500 to-yellow-600", text: "text-yellow-100", label: "ذهبي" },
    };
    return designs[design || "classic"] || designs.classic;
  };

  const designColor = getDesignColor(activeCard.cardDesign);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-amber-100">بطاقاتك</h3>
        <span className="text-sm text-amber-400/70">{currentIndex + 1} من {cards.length}</span>
      </div>

      <div className="relative h-64 md:h-72">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={String(activeCard.id)}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 },
            }}
            className="absolute inset-0"
          >
            <div
              className={`w-full h-full bg-gradient-to-br ${designColor.bg} rounded-3xl p-6 text-white shadow-2xl border border-white/10 flex flex-col justify-between overflow-hidden relative`}
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-white" />
                <div className="absolute -bottom-20 -left-20 w-40 h-40 rounded-full bg-white" />
              </div>

              <div className="relative z-10">
                <h4 className="text-2xl font-black mb-2">{brand.nameEn}</h4>
                <p className="text-sm opacity-90">{designColor.label}</p>
              </div>

              <div className="relative z-10 space-y-2">
                <p className="text-sm opacity-75">رقم البطاقة</p>
                <p className="font-mono text-lg tracking-wider font-bold">
                  {activeCard.cardNumber.replace(/(.{4})/g, '$1 ').trim()}
                </p>
                <p className="text-xs opacity-60 mt-4">
                  {activeCard.customerName || "عميل مميز"}
                </p>
              </div>

              <div className="relative z-10 grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                  <p className="text-xs opacity-70">اختام</p>
                  <p className="font-bold text-lg">{activeCard.stamps % 6}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                  <p className="text-xs opacity-70">مجاني</p>
                  <p className="font-bold text-lg">{Math.max(0, activeCard.freeCupsEarned - activeCard.freeCupsRedeemed)}</p>
                </div>
                <div className="bg-white/10 rounded-lg p-2 backdrop-blur">
                  <p className="text-xs opacity-70">نقاط</p>
                  <p className="font-bold text-lg">{activeCard.points}</p>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {cards.length > 1 && (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 z-20"
              onClick={() => {
                setDirection(-1);
                onSelectCard(cards[prevIndex]);
              }}
            >
              <ChevronRight className="w-5 h-5 text-amber-400" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 z-20"
              onClick={() => {
                setDirection(1);
                onSelectCard(cards[nextIndex]);
              }}
            >
              <ChevronLeft className="w-5 h-5 text-amber-400" />
            </Button>
          </>
        )}
      </div>

      {cards.length > 1 && (
        <div className="flex gap-2 justify-center">
          {cards.map((card, idx) => (
            <button
              key={String(card.id)}
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                onSelectCard(card);
              }}
              className={`h-2 rounded-full transition-all ${
                card.id === activeCard.id ? "bg-primary w-8" : "bg-white/20 w-2 hover:bg-white/30"
              }`}
              aria-label={`بطاقة ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
