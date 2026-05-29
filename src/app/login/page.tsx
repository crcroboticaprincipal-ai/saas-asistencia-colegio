"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Shield, Eye, EyeOff, AlertCircle, ArrowLeft,
  Building2, UserCog, Key, Lock, Mail
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

type Tab = "admin" | "personal";

function LoginForm() {
  const [tab, setTab] = useState<Tab>("admin");

  // Admin fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Personal (PIN) fields
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/admin";

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
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

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !pin.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Usuario o credencial incorrectos");
        return;
      }
      // Guardar tokens del personal en localStorage
      if (data.access_token) {
        localStorage.setItem("personal_access_token", data.access_token);
        localStorage.setItem("personal_data", JSON.stringify(data.user));
      }
      router.push("/aula");
      router.refresh();
    } catch {
      setError("Error de conexión al servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel rounded-2xl sm:rounded-3xl p-6 sm:p-10 border border-slate-200/60 shadow-2xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="h-28 sm:h-32 flex items-center justify-center mx-auto mb-5 overflow-hidden">
          <Image src="/logo.png" alt="Asisto Logo" width={314} height={126} className="w-auto h-full object-contain opacity-90" priority />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Asisto — Acceso Seguro</h1>
        <p className="text-slate-500 mt-1 text-xs sm:text-sm">Sistema de Control de Asistencia</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-slate-200 mb-6 bg-slate-100/60">
        <button
          type="button"
          onClick={() => { setTab("admin"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all ${
            tab === "admin"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-500 hover:text-slate-800"
          }`}
          id="tab-admin"
        >
          <Building2 className="w-4 h-4" />
          Administrador
        </button>
        <button
          type="button"
          onClick={() => { setTab("personal"); setError(""); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all ${
            tab === "personal"
              ? "bg-emerald-600 text-white shadow-md"
              : "text-slate-500 hover:text-slate-800"
          }`}
          id="tab-personal"
        >
          <UserCog className="w-4 h-4" />
          Personal / Docente
        </button>
      </div>

      {/* Admin Form */}
      {tab === "admin" && (
        <form onSubmit={handleAdminLogin} className="space-y-4 animate-fade-in">
          <div>
            <label htmlFor="admin-email" className="block text-sm font-medium text-slate-700 mb-1.5">
              <Mail className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
              Correo institucional
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@asisto.app"
              className="w-full bg-slate-100/60 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all text-sm"
              autoFocus
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm font-medium text-slate-700 mb-1.5">
              <Lock className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
              Contraseña
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-100/60 border border-slate-200 rounded-xl py-3 px-4 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 transition-all text-sm"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            id="btn-admin-login"
            disabled={loading || !email.trim() || !password.trim()}
            className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg text-sm mt-2 ${
              loading || !email.trim() || !password.trim()
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-700 text-white"
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Verificando…
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Ingresar al Panel Admin
              </>
            )}
          </button>
        </form>
      )}

      {/* Personal PIN Form */}
      {tab === "personal" && (
        <form onSubmit={handlePinLogin} className="space-y-4 animate-fade-in">
          <div>
            <label htmlFor="pin-username" className="block text-sm font-medium text-slate-700 mb-1.5">
              <UserCog className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
              Nombre de usuario
            </label>
            <input
              id="pin-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
              placeholder="ej: profe_garcia"
              className="w-full bg-slate-100/60 border border-slate-200 rounded-xl py-3 px-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-all text-sm font-mono"
              autoFocus
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="pin-code" className="block text-sm font-medium text-slate-700 mb-1.5">
              <Key className="w-3.5 h-3.5 inline mr-1.5 opacity-70" />
              PIN o contraseña
            </label>
            <div className="relative">
              <input
                id="pin-code"
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN de 4-6 dígitos o contraseña"
                className="w-full bg-slate-100/60 border border-slate-200 rounded-xl py-3 px-4 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 transition-all text-sm"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                tabIndex={-1}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Acepta PIN numérico (legado) o contraseña alfanumérica personalizada</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <button
            type="submit"
            id="btn-personal-login"
            disabled={loading || !username.trim() || !pin.trim()}
            className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg text-sm mt-2 ${
              loading || !username.trim() || !pin.trim()
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white"
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                Verificando…
              </>
            ) : (
              <>
                <Key className="w-4 h-4" />
                Ingresar al Aula Virtual
              </>
            )}
          </button>
        </form>
      )}

      <p className="text-center text-[10px] sm:text-xs text-slate-500 mt-6">
        UE Colegio Rafael Castillo • Sistema Asisto v2.0
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Back link */}
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6 sm:mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Volver al escáner
        </Link>

        <Suspense
          fallback={
            <div className="glass-panel rounded-2xl sm:rounded-3xl p-8 sm:p-10 border border-slate-200/60 shadow-2xl flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
