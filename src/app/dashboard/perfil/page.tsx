"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardPerfilRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/perfil");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );
}
