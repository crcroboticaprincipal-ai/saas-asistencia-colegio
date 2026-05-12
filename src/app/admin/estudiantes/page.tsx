"use client";

import dynamic from "next/dynamic";

const EstudiantesComponent = dynamic(() => import("./EstudiantesComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
    </div>
  ),
});

export default function AdminEstudiantesPage() {
  return <EstudiantesComponent />;
}
