"use client";

import dynamic from "next/dynamic";
import { ScanLine, Shield } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const EscanerComponent = dynamic(() => import("./escaner/EscanerComponent"), {
  ssr: false,
  loading: () => (
    <div className="glass-panel p-4 rounded-2xl flex items-center justify-center h-64 sm:h-72 border-2 border-blue-500/20 mx-4">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
        <p className="text-slate-400 text-sm font-medium">Iniciando sistema…</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass-panel border-b border-white/[0.08] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="h-8 flex items-center justify-center overflow-hidden">
            <Image src="/logo.png" alt="Qrono Logo" width={120} height={32} className="w-auto h-full object-contain filter invert opacity-90" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">
              Qrono Scanner
            </h1>
            <p className="text-[10px] sm:text-xs text-slate-500 leading-tight">
              Sistema de Asistencia
            </p>
          </div>
        </div>
        <Link
          href="/login"
          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all border border-white/5 hover:border-white/10"
        >
          <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Administración</span>
          <span className="sm:hidden">Admin</span>
        </Link>
      </header>

      {/* Scanner */}
      <main className="flex-1 flex flex-col items-center justify-start pb-6 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <EscanerComponent />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-6 py-3 text-center border-t border-white/5">
        <p className="text-[10px] sm:text-xs text-slate-600">
          Sistema de Asistencia v2.0 — UE Colegio Rafael Castillo
        </p>
      </footer>
    </div>
  );
}
