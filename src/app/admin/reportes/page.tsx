"use client";

import dynamic from "next/dynamic";

const ReportesComponent = dynamic(() => import("@/app/reportes/ReportesComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  ),
});

export default function AdminReportesPage() {
  return <ReportesComponent />;
}
