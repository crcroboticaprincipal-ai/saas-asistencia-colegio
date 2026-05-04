"use client";

import dynamic from "next/dynamic";
import { ScanLine, Shield } from "lucide-react";
import Link from "next/link";

const EscanerComponent = dynamic(() => import("./escaner/EscanerComponent"), {
  ssr: false,
  loading: () => (
    <div className="glass-panel p-4 rounded-3xl flex items-center justify-center h-72 border-2 border-indigo-500/20">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
        <p className="text-slate-400 text-sm font-medium">Iniciando cámara…</p>
      </div>
    </div>
  ),
});

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="glass-panel border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
            <ScanLine className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Control de Acceso</h1>
            <p className="text-xs text-slate-400">UE Colegio Rafael Castillo</p>
          </div>
        </div>
        <Link
          href="/login"
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5"
        >
          <Shield className="w-4 h-4" />
          <span className="hidden sm:inline">Admin</span>
        </Link>
      </header>

      {/* Scanner */}
      <main className="flex-1 flex flex-col items-center justify-start p-4 md:p-8 overflow-y-auto">
        <div className="w-full max-w-2xl">
          <EscanerComponent />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-3 text-center border-t border-white/5">
        <p className="text-xs text-slate-600">Sistema de Asistencia v1.0 — Escanee el carnet del estudiante</p>
      </footer>
    </div>
  );
}
