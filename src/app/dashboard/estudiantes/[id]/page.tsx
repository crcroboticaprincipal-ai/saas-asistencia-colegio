"use client";

import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function DashboardEstudianteRedirect({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();

  useEffect(() => {
    router.replace(`/admin/estudiantes/${id}`);
  }, [router, id]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}
