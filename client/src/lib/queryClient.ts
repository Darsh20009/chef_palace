import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getEmployeeHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const stored = localStorage.getItem("currentEmployee");
    const restoreKey = localStorage.getItem("qirox-restore-key");
    if (stored) {
      const employee = JSON.parse(stored);
      if (employee.id) headers['X-Employee-Id'] = employee.id;
    }
    if (restoreKey) headers['X-Restore-Key'] = restoreKey;
  } catch {}
  return headers;
}

async function tryRestoreSession(): Promise<boolean> {
  const stored = localStorage.getItem("currentEmployee");
  const restoreKey = localStorage.getItem("qirox-restore-key");
  if (!stored || !restoreKey) return false;
  
  try {
    const employee = JSON.parse(stored);
    const res = await fetch("/api/employees/restore-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ employeeId: employee.id, restoreKey }),
    });
    
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem("currentEmployee", JSON.stringify(data.employee));
      if (data.restoreKey) {
        localStorage.setItem("qirox-restore-key", data.restoreKey);
      }
      return true;
    }
  } catch (e) { console.warn('[queryClient] Session restore failed:', e); }
  
  localStorage.removeItem("currentEmployee");
  localStorage.removeItem("qirox-restore-key");
  return false;
}

let isRestoringSession = false;
let restorePromise: Promise<boolean> | null = null;

async function throwIfResNotOk(res: Response) {
 if (!res.ok) {
 const text = (await res.text()) || res.statusText;
 let errorMessage = text;
 try {
 const json = JSON.parse(text);
 errorMessage = json.error || json.message || text;
 } catch {
 }
 throw new Error(errorMessage);
 }
}

export function getErrorMessage(error: unknown, fallback = "حدث خطأ، يرجى المحاولة مرة أخرى"): string {
  if (!error) return fallback;
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.toLowerCase().includes("json") ||
    msg.toLowerCase().includes("unexpected end") ||
    msg.toLowerCase().includes("unexpected token") ||
    msg.toLowerCase().includes("failed to fetch") ||
    msg.toLowerCase().includes("networkerror") ||
    msg.toLowerCase().includes("load failed")
  ) {
    return "تعذّر الاتصال بالسيرفر، يرجى المحاولة مرة أخرى";
  }
  return msg || fallback;
}

export async function safeParseJson<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text || !text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

export async function apiRequest(
 method: string,
 url: string,
 data?: unknown | undefined,
 isRetry: boolean = false,
): Promise<Response> {
 const employeeHeaders = getEmployeeHeaders();
 
 const res = await fetch(url, {
 method,
 headers: data 
   ? { "Content-Type": "application/json", ...employeeHeaders }
   : { ...employeeHeaders },
 body: data ? JSON.stringify(data) : undefined,
 credentials: "include",
 });

 const newRestoreKey = res.headers.get('X-New-Restore-Key');
 if (newRestoreKey) {
   localStorage.setItem("qirox-restore-key", newRestoreKey);
 }

 if (res.status === 401 && !isRetry) {
   if (!isRestoringSession) {
     isRestoringSession = true;
     restorePromise = tryRestoreSession().finally(() => {
       isRestoringSession = false;
       restorePromise = null;
     });
   }
   
   const restored = await (restorePromise || tryRestoreSession());
   if (restored) {
     return apiRequest(method, url, data, true);
   }
 }

 await throwIfResNotOk(res);
 return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
 on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
 ({ on401: unauthorizedBehavior }) =>
 async ({ queryKey }) => {
 const url = queryKey.join("/") as string;
 const employeeHeaders = getEmployeeHeaders();
 
 let res = await fetch(url, {
 credentials: "include",
 headers: { ...employeeHeaders },
 });

 const newRestoreKey = res.headers.get('X-New-Restore-Key');
 if (newRestoreKey) {
   localStorage.setItem("qirox-restore-key", newRestoreKey);
 }

 if (res.status === 401 && unauthorizedBehavior !== "returnNull") {
   if (!isRestoringSession) {
     isRestoringSession = true;
     restorePromise = tryRestoreSession().finally(() => {
       isRestoringSession = false;
       restorePromise = null;
     });
   }
   const restored = await (restorePromise || tryRestoreSession());
   if (restored) {
     res = await fetch(url, { 
       credentials: "include",
       headers: { ...getEmployeeHeaders() },
     });
   }
 }

 if (unauthorizedBehavior === "returnNull" && res.status === 401) {
 return null;
 }

 await throwIfResNotOk(res);
 const text = await res.text();
 if (!text || !text.trim()) return null as any;
 try { return JSON.parse(text); } catch { return null as any; }
 };

export const queryClient = new QueryClient({
 defaultOptions: {
 queries: {
 queryFn: getQueryFn({ on401: "throw" }),
 refetchInterval: false,
 refetchOnWindowFocus: false,
 staleTime: 5 * 60 * 1000,
 gcTime: 10 * 60 * 1000,
 retry: 1,
 },
 mutations: {
 retry: false,
 },
 },
});
