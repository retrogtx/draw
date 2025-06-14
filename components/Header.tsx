"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Share2, Link2, PlusCircle, LogIn, Check } from "lucide-react";

export default function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "default";
  const [newRoomId, setNewRoomId] = useState("");
  const [copied, setCopied] = useState(false);

  const shareableLink = typeof window !== 'undefined' 
    ? `${window.location.origin}/?room=${roomId}` 
    : '';

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoinRoom = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newRoomId.trim()) {
      router.push(`/?room=${newRoomId.trim()}`);
    }
  };

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Link2 className="h-6 w-6" />
              <h1 className="text-lg font-semibold">
                Collaborative Whiteboard
              </h1>
            </Link>
            <div className="text-sm text-muted-foreground">
              Room: {roomId}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <form onSubmit={handleJoinRoom} className="flex items-center gap-2">
              <Input
                type="text"
                value={newRoomId}
                onChange={(e) => setNewRoomId(e.target.value)}
                placeholder="Enter Room ID"
                className="h-9 w-40"
              />
              <Button type="submit" variant="outline" size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Join
              </Button>
            </form>
            
            <Button asChild size="sm">
              <Link href={`/?room=${Math.random().toString(36).substring(2, 8)}`}>
                <PlusCircle className="h-4 w-4 mr-2" />
                New Room
              </Link>
            </Button>
            
            <Button
              onClick={copyToClipboard}
              variant="outline"
              size="sm"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
} 