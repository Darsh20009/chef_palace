import { useLocation } from "wouter";
import { useTranslate } from "@/lib/useTranslate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home, ArrowRight } from "lucide-react";
import qiroxLogoStaff from "@assets/qirox-logo-customer.png";

export default function NotFound() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-6">
          <img src={qiroxLogoStaff} alt="مكان الشيف" className="w-16 h-16 object-contain rounded-xl" />
          <div className="flex flex-col items-center gap-2">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h1 className="text-2xl font-bold text-foreground">{tc("404 — الصفحة غير موجودة", "404 — Page Not Found")}</h1>
            <p className="text-sm text-muted-foreground">
              {tc("الصفحة التي تبحث عنها غير موجودة أو تم نقلها.", "The page you are looking for does not exist or has been moved.")}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <Button onClick={() => setLocation("/")} className="w-full" data-testid="button-home">
              <Home className="h-4 w-4 ml-2" />
              {tc("العودة للرئيسية", "Back to Home")}
            </Button>
            <Button variant="outline" onClick={() => window.history.back()} className="w-full" data-testid="button-back">
              <ArrowRight className="h-4 w-4 ml-2" />
              {tc("العودة للصفحة السابقة", "Back to Previous Page")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
