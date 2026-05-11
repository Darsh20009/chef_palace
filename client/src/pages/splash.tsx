import { useLocation } from "wouter";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import chefsplaceLogo from "@assets/blackrose-logo.png";
import bannerImg from "@assets/blackrose-banner-1.png";

const GOLD = "#C06520";
const GOLD2 = "#e8892a";

function SteamParticle({ x, delay }: { x: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ left: `${x}%`, bottom: "0", width: 6, height: 6, background: `radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)` }}
      initial={{ opacity: 0, y: 0, scale: 1, x: 0 }}
      animate={{ opacity: [0, 0.7, 0.5, 0], y: -120, scale: [1, 1.8, 2.5, 1], x: [0, 10, -8, 4] }}
      transition={{ duration: 2.8, delay, ease: "easeOut", repeat: Infinity, repeatDelay: 1.2 }}
    />
  );
}

function FloatingDot({ style }: { style: React.CSSProperties }) {
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={style}
      animate={{ y: [0, -20, 0], opacity: [0.2, 0.7, 0.2] }}
      transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() * 2 }}
    />
  );
}

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

    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 1000);
    const t3 = setTimeout(() => setPhase(3), 1800);
    if (!isPreview) {
      const t4 = setTimeout(() => setLocation("/menu"), 3600);
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [setLocation]);

  if (visible === null || visible === false) return null;

  const dots = [
    { bottom: "15%", left: "8%", width: 5, height: 5, background: `${GOLD}44` },
    { bottom: "25%", right: "10%", width: 4, height: 4, background: `${GOLD2}55` },
    { top: "20%", left: "12%", width: 3, height: 3, background: "rgba(255,255,255,0.25)" },
    { top: "18%", right: "15%", width: 4, height: 4, background: `${GOLD}33` },
    { bottom: "35%", left: "5%", width: 3, height: 3, background: "rgba(255,255,255,0.18)" },
    { top: "35%", right: "7%", width: 5, height: 5, background: `${GOLD2}33` },
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="splash"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      >
        {/* Background */}
        <div className="absolute inset-0">
          <img
            src={bannerImg}
            alt=""
            className="w-full h-full object-cover object-center scale-110"
            style={{ filter: "saturate(1.2) brightness(0.28)" }}
          />
        </div>

        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/85" />
        <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${GOLD}08 0%, transparent 70%)` }} />

        {/* Animated scan line */}
        <motion.div
          className="absolute inset-x-0 pointer-events-none"
          style={{ height: 1, background: `linear-gradient(90deg, transparent, ${GOLD}55, transparent)` }}
          initial={{ top: "-2%" }}
          animate={{ top: ["0%", "100%", "0%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />

        {/* Floating ambient dots */}
        {dots.map((d, i) => <FloatingDot key={i} style={d} />)}

        {/* Steam particles above logo */}
        <div className="absolute" style={{ top: "calc(50% - 160px)", left: "50%", transform: "translateX(-50%)", width: 120, height: 90 }}>
          {[20, 35, 50, 65, 80].map((x, i) => (
            <SteamParticle key={i} x={x} delay={i * 0.4} />
          ))}
        </div>

        {/* Outer glow ring — appears first */}
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 260,
            height: 260,
            border: `1px solid ${GOLD}22`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -66%)",
          }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 1.2, type: "spring", stiffness: 60 }}
        />
        <motion.div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 200,
            height: 200,
            border: `1px solid ${GOLD}33`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -66%)",
          }}
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 1.1, type: "spring", stiffness: 65, delay: 0.08 }}
        />

        {/* Warm glow behind logo */}
        <motion.div
          className="absolute rounded-full blur-3xl pointer-events-none"
          style={{
            width: 280,
            height: 280,
            background: `radial-gradient(circle, ${GOLD}30 0%, transparent 65%)`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -66%)",
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: phase >= 1 ? 1 : 0, scale: 1 }}
          transition={{ duration: 1.0 }}
        />

        {/* Main content */}
        <div className="relative z-10 flex flex-col items-center gap-5 px-8 w-full">

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.3, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, type: "spring", stiffness: 100, damping: 12 }}
          >
            <motion.div
              className="w-32 h-32 rounded-3xl flex items-center justify-center p-3 shadow-2xl relative"
              style={{
                background: `linear-gradient(135deg, rgba(192,101,32,0.22) 0%, rgba(0,0,0,0.4) 100%)`,
                border: `1.5px solid ${GOLD}55`,
                backdropFilter: "blur(20px)",
                boxShadow: `0 0 60px ${GOLD}30, 0 12px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)`,
              }}
              animate={{ boxShadow: [`0 0 40px ${GOLD}25, 0 12px 48px rgba(0,0,0,0.6)`, `0 0 80px ${GOLD}45, 0 12px 48px rgba(0,0,0,0.6)`, `0 0 40px ${GOLD}25, 0 12px 48px rgba(0,0,0,0.6)`] }}
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
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
          >
            <motion.h1
              className="font-black text-white leading-tight"
              style={{
                fontSize: "clamp(22px, 6vw, 32px)",
                textShadow: "0 2px 30px rgba(0,0,0,0.9)",
                letterSpacing: "-0.01em",
              }}
              initial={{ opacity: 0, letterSpacing: "0.08em" }}
              animate={{ opacity: 1, letterSpacing: "-0.01em" }}
              transition={{ duration: 0.8, delay: 0.55 }}
            >
              مكان الشيف البخاري
            </motion.h1>

            <motion.p
              className="text-sm font-semibold tracking-[0.18em] uppercase"
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
            transition={{ duration: 0.7, delay: 0.05 }}
          >
            <div className="h-px w-20" style={{ background: `linear-gradient(to right, transparent, ${GOLD}80)` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: `${GOLD}70` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD2 }} />
            <div className="w-2.5 h-2.5 rounded-full border" style={{ borderColor: `${GOLD}70` }} />
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
            <div className="h-px w-20" style={{ background: `linear-gradient(to left, transparent, ${GOLD}80)` }} />
          </motion.div>

          {/* Animated loading dots */}
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
            className="w-40 h-0.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.08)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: phase >= 2 ? 1 : 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD2}, ${GOLD})`, backgroundSize: "200% 100%" }}
              initial={{ width: "0%" }}
              animate={{
                width: phase >= 3 ? "100%" : phase >= 2 ? "60%" : "0%",
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
          animate={{ opacity: phase >= 3 ? 0.55 : 0, y: phase >= 3 ? 0 : 10 }}
          transition={{ duration: 0.6 }}
        >
          <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${GOLD}60, transparent)` }} />
          <span className="text-white text-xs tracking-[0.22em] font-light">chefsplace.online</span>
          <div className="h-px w-12" style={{ background: `linear-gradient(to right, transparent, ${GOLD}60, transparent)` }} />
        </motion.div>

        {/* Corner decorations */}
        {[
          { top: 24, left: 24 },
          { top: 24, right: 24 },
          { bottom: 24, left: 24 },
          { bottom: 24, right: 24 },
        ].map((pos, i) => (
          <motion.div
            key={i}
            className="absolute pointer-events-none"
            style={{ ...pos, width: 20, height: 20, opacity: 0.35 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: phase >= 1 ? 0.35 : 0, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
          >
            <div
              className="w-full h-full"
              style={{
                borderTop: `1.5px solid ${GOLD}`,
                borderLeft: `1.5px solid ${GOLD}`,
                ...(pos.hasOwnProperty("right") ? { transform: "scaleX(-1)" } : {}),
                ...(pos.hasOwnProperty("bottom") ? { transform: `scaleY(-1)${pos.hasOwnProperty("right") ? " scaleX(-1)" : ""}` } : {}),
              }}
            />
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
