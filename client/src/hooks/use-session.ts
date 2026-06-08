import { useState, useEffect, useCallback } from "react";
import type { Customer, Employee } from "@shared/schema";

export type SessionUser = (Customer & { type: "customer" }) | (Employee & { type: "employee" });

interface SessionState {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Hook for managing user sessions across the application
 * Persists login data in localStorage and restores on page load
 */
export function useSession() {
  const [state, setState] = useState<SessionState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = () => {
      try {
        // Check for employee session
        const employeeData = localStorage.getItem("currentEmployee");
        if (employeeData) {
          const employee = JSON.parse(employeeData) as Employee;
          setState({
            user: { ...employee, type: "employee" } as SessionUser,
            isLoading: false,
            isAuthenticated: true,
          });
          return;
        }

        // Check for customer session
        const customerData = localStorage.getItem("currentCustomer");
        if (customerData) {
          const customer = JSON.parse(customerData) as Customer;
          setState({
            user: { ...customer, type: "customer" } as SessionUser,
            isLoading: false,
            isAuthenticated: true,
          });
          return;
        }

        // No session found
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      } catch (error) {
        console.error("Error restoring session:", error);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    restoreSession();
  }, []);

  // Save customer session
  const setCustomerSession = useCallback((customer: Customer | null) => {
    if (customer) {
      localStorage.setItem("currentCustomer", JSON.stringify(customer));
      localStorage.removeItem("currentEmployee");
      setState({
        user: { ...customer, type: "customer" } as SessionUser,
        isLoading: false,
        isAuthenticated: true,
      });
    } else {
      localStorage.removeItem("currentCustomer");
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  // Save employee session
  const setEmployeeSession = useCallback((employee: Employee | null) => {
    if (employee) {
      localStorage.setItem("currentEmployee", JSON.stringify(employee));
      localStorage.removeItem("currentCustomer");
      setState({
        user: { ...employee, type: "employee" } as SessionUser,
        isLoading: false,
        isAuthenticated: true,
      });
    } else {
      localStorage.removeItem("currentEmployee");
      setState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  // Logout user (clear all session data)
  const logout = useCallback(() => {
    localStorage.removeItem("currentCustomer");
    localStorage.removeItem("currentEmployee");
    localStorage.removeItem("qirox-restore-key");
    localStorage.removeItem("qahwa-customer");
    localStorage.removeItem("customer-phone");
    localStorage.removeItem("customer-id");
    localStorage.removeItem("qahwa-guest-mode");
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  // Update current session user
  const updateSession = useCallback((updates: Partial<SessionUser>) => {
    setState((prev) => {
      if (!prev.user) return prev;
      const updated = { ...prev.user, ...updates } as SessionUser;
      
      if (prev.user.type === "customer") {
        localStorage.setItem("currentCustomer", JSON.stringify(updated));
      } else {
        localStorage.setItem("currentEmployee", JSON.stringify(updated));
      }
      
      return {
        ...prev,
        user: updated,
      };
    });
  }, []);

  return {
    ...state,
    setCustomerSession,
    setEmployeeSession,
    logout,
    updateSession,
    isCustomer: state.user?.type === "customer",
    isEmployee: state.user?.type === "employee",
  };
}
