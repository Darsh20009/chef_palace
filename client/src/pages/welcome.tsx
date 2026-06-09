import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Star, MapPin, ChevronLeft, ChevronRight, LogOut, Sparkles, User, KeyRound, X as XIcon } from "lucide-react";
import bannerImage1 from "@assets/image_1773902748715.png";
import bannerImage2 from "@assets/image_1773902748715.png";
import { useCustomer } from "@/contexts/CustomerContext";
import { useTranslation } from "react-i18next";
import CurrentOrderBanner from "@/components/current-order-banner";
import { useRealtimeEvent } from "@/hooks/useRealtimeEngine";
import { useState } from "react";
import { CustomerFooter } from "@/components/customer-footer";

const restaurantLogo = "/logo.png";

export default function WelcomePage() {
  const [, setLocation] = useLocation();
  const { customer, isAuthenticated, logout } = useCustomer();
  const { t, i18n } = useTranslation();
  const [verificationCode, setVerificationCode] = useState<any>(null);

  useRealtimeEvent("points_verification_code", (data: any) => {
    setVerificationCode(data);
    setTimeout(() => setVerificationCode(null), 5 * 60 * 1000);
  });

  const features = [
    { icon: Coffee, title: t("welcome.specialty"), desc: t("welcome.specialty_desc"), color: "from-primary to-primary/70" },
    { icon: Star, title: t("welcome.luxury"), desc: t("welcome.luxury_desc"), color: "from-accent to-accent/70" },
    { icon: MapPin, title: t("welcome.locations"), desc: t("welcome.locations_desc"), color: "from-primary to-accent" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary/5 text-foreground overflow-hidden font-ibm-arabic">
      {/* Hero Section with Background Image */}
      <div className="relative min-h-[100dvh] flex flex-col">
        {/* Background Image with Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src={bannerImage1}
            alt="Coffee Background"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
        </div>

        {/* Floating decorative elements */}
        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-20 h-20 bg-primary/20 rounded-full blur-2xl animate-pulse" />
          <div className="absolute bottom-40 left-10 w-32 h-32 bg-accent/20 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>

        {/* Header */}
        <header className="relative z-20 flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xl p-1 border border-white/30">
              <img src={restaurantLogo} alt="Logo" className="w-full h-full object-contain rounded-xl" />
            </div>
            <span className="text-white font-bold text-lg tracking-wide">مكان الشيف </span>
          </div>

          <div className="flex items-center gap-2">
            <AnimatePresence>
              {verificationCode && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  className="bg-accent/90 backdrop-blur-md border border-white/20 rounded-xl p-2 px-3 flex items-center gap-3 shadow-xl"
                >
                  <div className="bg-white/20 p-1.5 rounded-lg">
                    <KeyRound className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-white/70 leading-none">رمز التحقق</span>
                    <span className="text-lg font-bold text-white leading-none tracking-widest">{verificationCode.code}</span>
                  </div>
                  <button onClick={() => setVerificationCode(null)} className="text-white/50 hover:text-white p-1">
                    <XIcon className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {isAuthenticated && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                const storedCustomer = localStorage.getItem("qahwa-customer") || localStorage.getItem("currentCustomer");
                if (isAuthenticated || customer || storedCustomer) {
                  setLocation("/profile");
                } else {
                  setLocation("/auth");
                }
              }}
              className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20"
              data-testid="button-user-profile"
            >
              <User className="w-5 h-5 text-white" />
            </Button>
          </div>
        </header>

        <div className="absolute top-4 left-4 z-30">
          <CurrentOrderBanner />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col justify-center items-center px-6 relative z-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-lg"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="w-28 h-28 mx-auto mb-8 rounded-2xl overflow-hidden backdrop-blur-xl p-2 border border-white/20 shadow-xl bg-black/30"
            >
              <img src={restaurantLogo} alt="Logo" className="w-full h-full object-contain rounded-2xl" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <h1 className="md:text-6xl font-bold mb-3 text-white drop-shadow-lg text-[39px]">
                {t("app.name")}
              </h1>
            </motion.div>

            {isAuthenticated ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mb-10"
              >
                <p className="text-white text-2xl mb-2 font-semibold">
                  {t("welcome.greeting", { name: customer?.name })}
                </p>
                <p className="text-white/70 text-base">
                  {t("welcome.missed_you")}
                </p>
              </motion.div>
            ) : (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-white/80 text-xl mb-10"
              >
                {t("welcome.stories")}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="space-y-3"
            >
              <Button
                onClick={() => setLocation("/menu")}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl text-lg font-bold shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                data-testid="button-explore-menu"
              >
                {t(isAuthenticated ? "menu.order_now" : "welcome.explore")}
                {i18n.language === 'ar' ? <ChevronLeft className="mr-2 w-5 h-5" /> : <ChevronRight className="ml-2 w-5 h-5" />}
              </Button>

              {!isAuthenticated ? (
                <Button
                  variant="outline"
                  onClick={() => setLocation("/auth")}
                  className="w-full h-14 bg-white/10 backdrop-blur-md border-white/30 text-white rounded-2xl text-lg hover:bg-white/20"
                  data-testid="button-login"
                >
                  {t("welcome.login")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setLocation("/profile")}
                  className="w-full h-14 bg-white/10 backdrop-blur-md border-white/30 text-white rounded-2xl text-lg hover:bg-white/20"
                  data-testid="button-my-account"
                >
                  {t("welcome.my_account")}
                </Button>
              )}
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="relative z-20 pb-8 text-center"
        >
          <div className="w-6 h-10 mx-auto border-2 border-white/30 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-3 bg-white/50 rounded-full" />
          </div>
        </motion.div>
      </div>
      {/* Features Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold text-foreground mb-3">
              {t("welcome.why")}
            </h2>
            <p className="text-muted-foreground">
              {t("welcome.experience")}
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                viewport={{ once: true }}
                className="bg-white rounded-2xl p-6 shadow-lg border border-border hover:shadow-xl transition-shadow"
              >
                <div className={`w-14 h-14 mb-4 flex items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>
                  <f.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      {/* Gallery Section */}
      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden shadow-lg"
            >
              <img src={bannerImage1} alt="Coffee" className="w-full h-48 object-cover" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="rounded-2xl overflow-hidden shadow-lg"
            >
              <img src={bannerImage2} alt="Coffee" className="w-full h-48 object-cover" />
            </motion.div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <CustomerFooter />
    </div>
  );
}
