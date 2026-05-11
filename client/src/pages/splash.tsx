import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
const chefsplaceLogo = "/logo.png?v=18";

const GOLD = "#C06520";
const GOLD2 = "#e8892a";

export default function SplashScreen() {
  const [, setLocation] = useLocation();
  const [visible, setVisible] = useState<boolean | null>(null);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const isPreview = window.location.pathname === "/splash";
    if (!isPreview && localStorage.getItem("hasSeenSplash")) {
      setVisible(false);
      setLocation("/menu");
      return;
    }
    setVisible(true);
    if (!isPreview) localStorage.setItem("hasSeenSplash", "true");
  }, [setLocation]);

  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setPhase(1), 300);
    const t2 = setTimeout(() => setPhase(2), 800);
    const t3 = setTimeout(() => setPhase(3), 1500);
    const isPreview = window.location.pathname === "/splash";
    const tRedirect = !isPreview ? setTimeout(() => setLocation("/menu"), 2800) : null;
    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      if (tRedirect) clearTimeout(tRedirect);
    };
  }, [visible, setLocation]);

  if (visible === null || visible === false) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-black"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Background video (Chef Bukhari) */}
        <video
          src="/videos/splash-bg.mp4?v=1"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay for logo readability */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, rgba(26,14,0,0.55) 0%, rgba(0,0,0,0.85) 80%)` }}
        />

        {/* Logo overlay on top of video */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-8 w-full">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, type: "spring", stiffness: 100, damping: 14 }}
          >
            <motion.div
              className="w-32 h-32 rounded-3xl flex items-center justify-center p-3 shadow-2xl relative"
              style={{
                background: `linear-gradient(135deg, rgba(192,101,32,0.25) 0%, rgba(0,0,0,0.5) 100%)`,
                border: `1.5px solid ${GOLD}66`,
                backdropFilter: "blur(20px)",
                boxShadow: `0 0 60px ${GOLD}35, 0 12px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)`,
              }}
              animate={{
                boxShadow: [
                  `0 0 40px ${GOLD}28, 0 12px 48px rgba(0,0,0,0.7)`,
                  `0 0 90px ${GOLD}50, 0 12px 48px rgba(0,0,0,0.7)`,
                  `0 0 40px ${GOLD}28, 0 12px 48px rgba(0,0,0,0.7)`,
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <img
                src={chefsplaceLogo}
                alt="مكان الشيف البخاري"
                className="w-full h-full object-contain drop-shadow-xl"
              />
            </motion.div>
          </motion.div>

          {/* Brand name */}
          <motion.div
            className="text-center space-y-1"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <motion.h1
              className="font-black text-white leading-tight drop-shadow-2xl"
              style={{
                fontSize: "clamp(22px, 6vw, 30px)",
                textShadow: "0 2px 30px rgba(0,0,0,0.95)",
              }}
            >
              مكان الشيف البخاري
            </motion.h1>
            <motion.p
              className="text-sm font-semibold tracking-[0.18em]"
              style={{ color: GOLD }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase >= 1 ? 1 : 0 }}
              transition={{ duration: 0.6 }}
            >
              أصالة البخاري بنكهة الشيف
            </motion.p>
          </motion.div>

          {/* Ornamental divider */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: phase >= 1 ? 1 : 0, scaleX: phase >= 1 ? 1 : 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="h-px w-16" style={{ background: `linear-gradient(to right, transparent, ${GOLD}80)` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: `${GOLD}70` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD2 }} />
            <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: `${GOLD}70` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            <div className="h-px w-16" style={{ background: `linear-gradient(to left, transparent, ${GOLD}80)` }} />
          </motion.div>

          {/* Loading dots */}
          <motion.div
            className="flex items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 2 ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                className="rounded-full"
                style={{ width: i === 2 ? 10 : 6, height: i === 2 ? 10 : 6, background: i === 2 ? GOLD : `${GOLD}66` }}
                animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
              />
            ))}
          </motion.div>

          {/* Progress bar */}
          <motion.div
            className="w-36 h-0.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.1)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 2 ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD2}, ${GOLD})`, backgroundSize: "200% 100%" }}
              initial={{ width: "0%" }}
              animate={{
                width: phase >= 3 ? "100%" : phase >= 2 ? "55%" : "0%",
                backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"],
              }}
              transition={{ width: { duration: 1.6, ease: "easeInOut" }, backgroundPosition: { duration: 2, repeat: Infinity } }}
            />
          </motion.div>
        </div>

        {/* Bottom signature */}
        <motion.div
          className="absolute bottom-10 left-0 right-0 flex flex-col items-center gap-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: phase >= 3 ? 0.6 : 0, y: phase >= 3 ? 0 : 10 }}
          transition={{ duration: 0.6 }}
        >
          <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${GOLD}60, transparent)` }} />
          <span className="text-white text-xs tracking-[0.22em] font-light drop-shadow-lg">chefsplace.online</span>
          <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${GOLD}60, transparent)` }} />
          <a
            href="https://qiroxstudio.online"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-[11px] tracking-[0.18em] font-light text-white/70 hover:text-white transition-colors"
            data-testid="link-qirox-studio"
            onClick={(e) => e.stopPropagation()}
          >
            Made by <span style={{ color: GOLD }} className="font-semibold">QIROX Studio</span>
          </a>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
