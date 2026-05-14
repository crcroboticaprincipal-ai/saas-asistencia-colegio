"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Shield, Eye, EyeOff, AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";

import Image from "next/image";

function LoginForm() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error de autenticación");
        return;
      }

      router.push(from);
      router.refresh();
    } catch {
      setError("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-white/[0.08] shadow-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="h-12 sm:h-16 flex items-center justify-center mx-auto mb-6 overflow-hidden">
          <Image src="/logo.png" alt="Qrono Logo" width={160} height={64} className="w-auto h-full object-contain filter invert opacity-90" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Qrono Admin</h1>
        <p className="text-slate-400 mt-2 text-xs sm:text-sm">Ingresa la contraseña para acceder al sistema</p>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
            Contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa la contraseña de administrador"
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl py-3 sm:py-3.5 px-4 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all text-sm sm:text-base"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !password.trim()}
          className={`w-full py-3 sm:py-3.5 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg text-sm sm:text-base ${
            loading || !password.trim()
              ? "bg-slate-700/50 text-slate-400 cursor-not-allowed"
              : "btn-primary"
          }`}
        >
          {loading ? (
            <>
              <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              Verificando…
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              Ingresar al Panel
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[10px] sm:text-xs text-slate-600 mt-6">UE Colegio Rafael Castillo • Sistema de Asistencia</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-red-500/8 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back link */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6 sm:mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Volver al escáner
        </Link>

        <Suspense
          fallback={
            <div className="glass-panel rounded-2xl sm:rounded-3xl p-8 sm:p-10 border border-white/[0.08] shadow-2xl flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
