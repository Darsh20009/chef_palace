import { useLocation } from "wouter";
import { ArrowRight, Construction } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/lib/useTranslate";

export default function PartnerProgram() {
  const [, setLocation] = useLocation();
  const tc = useTranslate();

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
        <Construction className="w-8 h-8 text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {tc("برنامج الشركاء", "Partner Program")}
      </h1>
      <p className="text-gray-500 mb-8 max-w-sm">
        {tc(
          "هذه الميزة قيد التطوير وستكون متاحة قريباً.",
          "This feature is under development and will be available soon."
        )}
      </p>
      <Button variant="outline" onClick={() => setLocation("/manager/dashboard")}>
        <ArrowRight className="w-4 h-4 ml-2" />
        {tc("العودة للرئيسية", "Back to Dashboard")}
      </Button>
    </div>
  );
}
