"use client";

import dynamic from "next/dynamic";
import { ScanLine } from "lucide-react";

const EscanerComponent = dynamic(() => import("./EscanerComponent"), {
  ssr: false,
  loading: () => (
    <div className="max-w-2xl mx-auto mt-8 space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center justify-center gap-3">
          <ScanLine className="w-8 h-8 text-indigo-400" />
          Escáner de Acceso
        </h1>
        <p className="text-slate-400">Cargando cámara…</p>
      </div>
      <div className="glass-panel p-4 rounded-3xl flex items-center justify-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    </div>
  ),
});

export default function EscanerPage() {
  return <EscanerComponent />;
}
