import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
const blackRoseLogo = "/logo.png";

export default function QiroxLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [, setLocation] = useLocation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/qirox/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem("qirox_token", data.token);
        setLocation("/qirox/dashboard");
      } else {
        setError(data.error || "Access denied");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#2D9B6E]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#2D9B6E]/3 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4">
              <img src={blackRoseLogo} alt="مكان الشيف البخاري" className="w-full h-full object-contain rounded-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">مكان الشيف البخاري</h1>
            <p className="text-[#666] text-sm mt-1">System Control Panel</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-[#888] text-xs font-medium mb-2 uppercase tracking-wider">
                Access Code
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3.5 text-white placeholder-[#444] focus:outline-none focus:border-[#2D9B6E] focus:ring-1 focus:ring-[#2D9B6E]/50 transition-all text-center tracking-[0.3em] text-lg"
                placeholder="••••••••••"
                autoFocus
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full bg-gradient-to-r from-[#2D9B6E] to-[#25845d] hover:from-[#34b07e] hover:to-[#2D9B6E] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-[#2D9B6E]/20 hover:shadow-[#2D9B6E]/30"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Authenticating...
                </span>
              ) : (
                "Access System"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#1e1e1e] text-center">
            <p className="text-[#444] text-xs">
              مكان الشيف البخاري v3.0 — Restricted Access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
