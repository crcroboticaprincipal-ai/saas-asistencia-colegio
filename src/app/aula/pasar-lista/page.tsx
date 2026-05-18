"use client";
import dynamic from "next/dynamic";

const PasarListaComponent = dynamic(() => import("./PasarListaComponent"), { ssr: false });

export default function PasarListaPage() {
  return <PasarListaComponent />;
}
