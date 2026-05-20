"use client";
import dynamic from "next/dynamic";

const ImportarPersonalComponent = dynamic(
  () => import("./ImportarPersonalComponent"),
  { ssr: false }
);

export default function ImportarPersonalPage() {
  return <ImportarPersonalComponent />;
}
