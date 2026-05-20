"use client";
import dynamic from "next/dynamic";

const MateriasComponent = dynamic(() => import("./MateriasComponent"), { ssr: false });

export default function MateriasPage() {
  return <MateriasComponent />;
}
