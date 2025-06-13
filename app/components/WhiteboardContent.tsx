"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Whiteboard from "@/app/components/Whiteboard";
import Link from "next/link";

export default function WhiteboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "default";
  const [newRoomId, setNewRoomId] = useState("");
  const [copied, setCopied] = useState(false);
  
  const shareableLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/whiteboard?room=${roomId}` 
    : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomId.trim()) {
      router.push(`/whiteboard?room=${newRoomId.trim()}`);
    }
  };
  
  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-zinc-800 border-b border-zinc-700">
        <div className="text-white font-medium mb-3 sm:mb-0">
          <h1 className="text-xl font-bold">Collaborative Whiteboard</h1>
          <div className="text-zinc-400 text-sm mt-1">Room: {roomId}</div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <form onSubmit={handleJoinRoom} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={newRoomId}
              onChange={(e) => setNewRoomId(e.target.value)}
              placeholder="Enter room ID"
              className="px-3 py-2 bg-zinc-700 text-white rounded border border-zinc-600 text-sm w-full sm:w-auto"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm whitespace-nowrap"
            >
              Join Room
            </button>
          </form>
          
          <Link
            href={`/whiteboard?room=${Math.random().toString(36).substring(2, 8)}`}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-sm w-full sm:w-auto text-center"
          >
            Create New Room
          </Link>
          
          <button
            onClick={copyToClipboard}
            className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            {copied ? (
              <>
                <span>✓ Copied!</span>
              </>
            ) : (
              <>
                <span>Share Room</span>
              </>
            )}
          </button>
        </div>
      </div>
      
      <div className="flex-1 relative">
        <Whiteboard roomId={roomId} />
      </div>
    </>
  );
} 