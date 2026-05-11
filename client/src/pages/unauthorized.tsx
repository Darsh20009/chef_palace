import { useLocation } from "wouter";
import { useTranslate } from "@/lib/useTranslate";
import { ShieldX, Home, ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  const tc = useTranslate();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 rounded-full bg-destructive/10 p-4 w-fit">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          <CardTitle className="text-2xl">{tc("غير مصرح", "Unauthorized")}</CardTitle>
          <CardDescription className="text-base">
            {tc("ليس لديك الصلاحيات الكافية للوصول إلى هذه الصفحة", "You do not have sufficient permissions to access this page")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {tc("إذا كنت تعتقد أن هذا خطأ، يرجى التواصل مع المدير أو تسجيل الدخول بحساب مختلف.", "If you think this is an error, please contact the manager or log in with a different account.")}
          </p>
          
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => setLocation("/")}
              className="w-full"
              data-testid="button-home"
            >
              <Home className="h-4 w-4 ml-2" />
              {tc("العودة للرئيسية", "Back to Home")}
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full"
              data-testid="button-back"
            >
              <ArrowRight className="h-4 w-4 ml-2" />
              {tc("العودة للصفحة السابقة", "Back to Previous Page")}
            </Button>

            <div className="flex gap-2">
              <Button 
                variant="ghost"
                onClick={() => setLocation("/employee/gateway")}
                className="flex-1"
                data-testid="button-employee-login"
              >
                <LogIn className="h-4 w-4 ml-2" />
                {tc("دخول الموظفين", "Employee Login")}
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setLocation("/manager/login")}
                className="flex-1"
                data-testid="button-manager-login"
              >
                <LogIn className="h-4 w-4 ml-2" />
                {tc("دخول المديرين", "Manager Login")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
