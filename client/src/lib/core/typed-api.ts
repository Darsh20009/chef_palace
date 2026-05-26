/**
 * Phase 9 — Typed API wrapper around the existing fetch.
 * Returns Result<T, ApiError> instead of throwing — forces callers to handle errors.
 *
 * Usage:
 *   const r = await api.get<Order[]>("/api/orders");
 *   if (!r.ok) toast({ title: r.error.message }); else setOrders(r.value);
 */

export interface ApiError {
  code: string;
  status: number;
  message: string;
  meta?: any;
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; error: ApiError };

async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? safeParse(text) : null;
    if (!res.ok) {
      return {
        ok: false,
        error: {
          code: data?.code || `HTTP_${res.status}`,
          status: res.status,
          message: data?.error || data?.message || res.statusText,
          meta: data?.meta,
        },
      };
    }
    return { ok: true, value: data as T };
  } catch (e: any) {
    return { ok: false, error: { code: "NETWORK", status: 0, message: e?.message || "Network error" } };
  }
}

function safeParse(t: string) { try { return JSON.parse(t); } catch { return null; } }

export const api = {
  get:    <T>(url: string)             => request<T>("GET", url),
  post:   <T>(url: string, body?: any) => request<T>("POST", url, body),
  patch:  <T>(url: string, body?: any) => request<T>("PATCH", url, body),
  put:    <T>(url: string, body?: any) => request<T>("PUT", url, body),
  delete: <T>(url: string)             => request<T>("DELETE", url),
};
