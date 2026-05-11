import { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ManagerSidebar, MobileBottomNav } from "./manager-sidebar";

interface ManagerLayoutProps {
  children: ReactNode;
}

export function ManagerLayout({ children }: ManagerLayoutProps) {
  const [, navigate] = useLocation();

  const { data: session } = useQuery<any>({
    queryKey: ["/api/verify-session"],
  });

  const manager = session?.employee || session?.manager || null;
  const role = manager?.role || "manager";

  const handleLogout = async () => {
    await fetch("/api/employees/logout", { method: "POST" });
    localStorage.removeItem("chefsplace-restore-key");
    navigate("/manager/login");
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <ManagerSidebar
        manager={manager}
        onLogout={handleLogout}
        role={role}
      />
      <main className="flex-1 overflow-auto pb-16 lg:pb-0">
        {children}
      </main>
      <MobileBottomNav manager={manager} />
    </div>
  );
}
