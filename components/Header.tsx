"use client";

import { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Share2,  
  PlusCircle, 
  LogIn, 
  Check, 
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import useWhiteboardStore from "@/app/store/useWhiteboardStore";
import { Separator } from "./ui/separator";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export default function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "default";
  const [newRoomId, setNewRoomId] = useState("");
  const [copied, setCopied] = useState(false);
  const { setIsClearing } = useWhiteboardStore();

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
    <TooltipProvider delayDuration={100}>
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-20 shadow-sm border-border/40">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center">
            <div className="flex items-center gap-6">
              <Link href="/" className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight">
                  Drawboard
                </h1>
              </Link>
              <div className="text-sm text-muted-foreground/80 hidden sm:block tracking-wide">
                Room: <span className="font-semibold text-foreground">{roomId}</span>
              </div>
            </div>
            
            <div className="flex flex-1 items-center justify-end gap-2">
              <Dialog>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="icon">
                        <LogIn className="h-4 w-4" />
                        <span className="sr-only">Join Room</span>
                      </Button>
                    </DialogTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Join Room</p>
                  </TooltipContent>
                </Tooltip>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Join or Create a Room</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleJoinRoom} className="grid gap-4 py-4">
                    <Input
                      id="room-id"
                      placeholder="Enter Room ID"
                      value={newRoomId}
                      onChange={(e) => setNewRoomId(e.target.value)}
                    />
                    <Button type="submit">Join Room</Button>
                  </form>
                </DialogContent>
              </Dialog>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button asChild size="icon" variant="outline">
                    <Link href={`/?room=${Math.random().toString(36).substring(2, 8)}`}>
                      <PlusCircle className="h-4 w-4" />
                      <span className="sr-only">New Room</span>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>New Room</p>
                </TooltipContent>
              </Tooltip>
            
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    size="icon"
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Share2 className="h-4 w-4" />
                    )}
                    <span className="sr-only">{copied ? 'Copied' : 'Share'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{copied ? 'Copied!' : 'Share'}</p>
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-6" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setIsClearing(true)}
                    variant="destructive"
                    size="icon"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Clear</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Clear</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
} 