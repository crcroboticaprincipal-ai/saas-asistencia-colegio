"use client";

import { CobranzasMasivasComponent } from "@/components/CobranzasMasivasComponent";
import { AdminSidebar } from "@/components/AdminSidebar";

export default function DashboardCobranzasPage() {
  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden print:h-auto print:overflow-visible print:block">
      <AdminSidebar />
      <main className="flex-1 h-[calc(100vh-64px)] md:h-full overflow-y-auto p-4 sm:p-6 md:p-8 pb-24 md:pb-8 print:h-auto print:overflow-visible print:p-0">
        <div className="max-w-7xl mx-auto h-full print:h-auto print:max-w-none">
          <CobranzasMasivasComponent />
        </div>
      </main>
    </div>
  );
}
