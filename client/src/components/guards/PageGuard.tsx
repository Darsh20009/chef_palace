import { ReactNode, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LoadingState } from "@/components/ui/states";

interface PageGuardProps {
  children: ReactNode;
  requiredPage: string;
  redirectTo?: string;
}

export function PageGuard({ 
  children, 
  requiredPage,
  redirectTo = "/unauthorized"
}: PageGuardProps) {
  const [, setLocation] = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const checkPageAccess = async () => {
      setIsChecking(true);

      try {
        const employee = localStorage.getItem("currentEmployee");
        
        if (!employee) {
          setLocation("/employee/gateway");
          return;
        }

        const parsed = JSON.parse(employee);
        
        // Admin, owner, manager have access to all pages
        if (["admin", "owner", "manager"].includes(parsed.role)) {
          setIsAuthorized(true);
          setIsChecking(false);
          return;
        }

        // Check if employee has access to this page
        const allowedPages = parsed.allowedPages || [];
        
        if (allowedPages.includes(requiredPage) || allowedPages.includes("*")) {
          setIsAuthorized(true);
        } else {
          setLocation(redirectTo);
        }
      } catch (error) {
        console.error("Page access check failed:", error);
        setLocation(redirectTo);
      } finally {
        setIsChecking(false);
      }
    };

    checkPageAccess();
  }, [requiredPage, redirectTo, setLocation]);

  if (isChecking) {
    return <LoadingState message="جاري التحقق من صلاحيات الوصول..." />;
  }

  if (!isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
