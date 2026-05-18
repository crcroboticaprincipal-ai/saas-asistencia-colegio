"use client";
import dynamic from "next/dynamic";

const CalendarioComponent = dynamic(() => import("./CalendarioComponent"), { ssr: false });

export default function CalendarioPage() {
  return <CalendarioComponent />;
}
