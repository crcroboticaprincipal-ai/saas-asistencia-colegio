"use client";
import dynamic from "next/dynamic";

const RRHHComponent = dynamic(() => import("./RRHHComponent"), { ssr: false });

export default function RRHHPage() {
  return <RRHHComponent />;
}
