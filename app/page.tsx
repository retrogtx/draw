"use client";

import { Suspense } from "react";
import WhiteboardContent from "@/app/components/WhiteboardContent";

export default function WhiteboardPage() {
  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      <Suspense fallback={<div className="p-4 text-white">Loading...</div>}>
        <WhiteboardContent />
      </Suspense>
    </div>
  );
} 