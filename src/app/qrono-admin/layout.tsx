import { ReactNode } from "react";
import Link from "next/link";
import { Shield, ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Qrono Admin — Panel Técnico",
  description: "Panel de administración técnica exclusivo para SuperAdmin",
};

export default function QronoAdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="glass-panel border-b border-white/[0.06] px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-violet-500/20 border border-violet-500/30 rounded-lg">
            <Shield className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">Qrono Admin</h1>
            <p className="text-[10px] text-slate-500">Panel Técnico — SuperAdmin</p>
          </div>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver al Dashboard
        </Link>
      </header>

      <main className="flex-1 p-6 md:p-8 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
