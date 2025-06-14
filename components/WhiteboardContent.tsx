"use client";

import { useSearchParams } from "next/navigation";
import Whiteboard from "@/components/Whiteboard";
import Header from "./Header";
import { Toaster } from "@/components/ui/sonner"

export default function WhiteboardContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "default";
  
  return (
    <div className="flex flex-col h-screen">
      <Header />
      <div className="flex-1 relative">
        <Whiteboard roomId={roomId} />
      </div>
      <Toaster />
    </div>
  );
} 