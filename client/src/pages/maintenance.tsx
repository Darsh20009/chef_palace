import { motion } from "framer-motion";
import { useTranslate } from "@/lib/useTranslate";
import { Coffee, Settings, Wrench, Clock } from "lucide-react";
import qiroxLogo from "@assets/qirox-logo-customer.png";

export default function MaintenancePage({ reason = "maintenance" }: { reason?: string }) {
  const tc = useTranslate();

  const isUpdate = reason === "update" || reason === tc("تحديث", "update");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="relative inline-block">
          <img src={qiroxLogo} alt="مكان الشيف البخاري" className="w-24 h-24 mx-auto rounded-3xl shadow-xl mb-6" />
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
            className="absolute -top-2 -right-2 bg-primary p-2 rounded-full shadow-lg"
          >
            {isUpdate ? <Clock className="w-5 h-5 text-white" /> : <Settings className="w-5 h-5 text-white" />}
          </motion.div>
        </div>

        <div className="space-y-4">
          <h1 className="text-3xl font-bold text-foreground font-ibm-arabic">
            {isUpdate ? tc("جاري التحديث...", "Updating...") : tc("الموقع تحت الصيانة", "Site Under Maintenance")}
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {isUpdate 
              ? tc("نحن نقوم بإضافة مميزات جديدة لنقدم لكم تجربة أفضل. سنعود قريباً جداً!", "We are adding new features to provide you with a better experience. We'll be back very soon!") 
              : tc("نحن نقوم ببعض أعمال الصيانة الدورية لنضمن لكم أفضل جودة. شكراً لصبركم!", "We are performing routine maintenance to ensure the best quality for you. Thank you for your patience!")}
          </p>
        </div>

        <div className="py-8">
          <div className="flex justify-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Coffee className="w-6 h-6 text-primary animate-bounce" />
            </div>
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <Wrench className="w-6 h-6 text-accent animate-pulse" />
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground italic">
            استمتع برائحة القهوة ريثما نعود... ☕
          </p>
        </div>
      </motion.div>
    </div>
  );
}
