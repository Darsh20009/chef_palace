import "express-session";

declare module "express-session" {
  interface SessionData {
    employee?: {
      id: string;
      username: string;
      role: string;
      branchId?: string;
      fullName: string;
    };
    restoreKey?: string;
    customer?: {
      id: string;
      name: string;
      phone: string;
      email?: string;
      points?: number;
      pendingPoints?: number;
      cardPassword?: string;
    };
  }
}
