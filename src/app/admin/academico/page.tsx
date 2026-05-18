"use client";
import dynamic from "next/dynamic";

const AnaliticaComponent = dynamic(() => import("./AnaliticaComponent"), { ssr: false });

export default function AcademicoPage() {
  return <AnaliticaComponent />;
}
