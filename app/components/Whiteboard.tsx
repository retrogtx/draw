"use client";

import { useEffect, useRef } from "react";
import useWhiteboardStore, { supabase, Point } from "@/app/store/useWhiteboardStore";

// Optionally, you can comment out the icon if lucide-react is not installed yet
// import { Trash2 } from "lucide-react";

interface WhiteboardProps {
  roomId: string;
}

// Structure to store a complete stroke
interface Stroke {
  points: Point[];
  color: string;
  userId: string;
}

export default function Whiteboard({ roomId }: WhiteboardProps) {
  const {
    username,
    isConnected,
    activeUsers,
    isDrawing,
    currentColor,
    userId,
    pointsBuffer,
    setIsConnected,
    setActiveUsers,
    setIsDrawing,
    setCurrentColor,
    addPointToBuffer,
    clearPointsBuffer,
    clearCurrentPath,
    setRoomId,
    setChannel,
    getChannelName
  } = useWhiteboardStore();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const isInitialSetup = useRef(true);
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const strokesRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<Point[]>([]);

  // Set up room ID when component mounts or room changes
  useEffect(() => {
    setRoomId(roomId);
    return () => {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    };
  }, [roomId, setRoomId]);

  // Set up canvas - ONLY run once on mount, not on color change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const setupCanvas = () => {
      const container = canvas.parentElement as HTMLElement | null;
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width * 2;
      canvas.height = height * 2;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(2, 2);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.lineWidth = 5;
      context.strokeStyle = currentColor;
      contextRef.current = context;
      if (isInitialSetup.current) {
        context.fillStyle = 'rgba(0,0,0,0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        isInitialSetup.current = false;
      }
    };
    
    setupCanvas();
    
    const resizeObserver = new window.ResizeObserver(() => {
      setupCanvas();
      // Redraw all strokes when resizing
      redrawAllStrokes();
    });
    
    const container = canvas.parentElement as HTMLElement | null;
    if (container) resizeObserver.observe(container);
    window.addEventListener('resize', setupCanvas);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', setupCanvas);
    };
  }, []); // Remove currentColor from dependencies

  // Update canvas color when color changes - separate effect
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = currentColor;
    }
  }, [currentColor]);

  // Helper to redraw all stored strokes
  const redrawAllStrokes = () => {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas) return;
    
    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw all strokes
    strokesRef.current.forEach(stroke => {
      const currentStrokeStyle = context.strokeStyle;
      context.strokeStyle = stroke.color;
      
      let isNewPath = true;
      for (let i = 0; i < stroke.points.length; i++) {
        const point = stroke.points[i];
        if (point.type === 'start' || isNewPath) {
          context.beginPath();
          context.moveTo(point.x, point.y);
          isNewPath = false;
        } else if (point.type === 'move') {
          context.lineTo(point.x, point.y);
          context.stroke();
        }
      }
      
      context.strokeStyle = currentStrokeStyle;
    });
  };

  // Request existing strokes when joining a room
  const requestExistingStrokes = (channel: any) => {
    channel.send({
      type: 'broadcast',
      event: 'request_strokes',
      payload: {
        userId: userId,
        requestTime: new Date().getTime(),
      },
    });
  };

  // Set up Supabase realtime connection
  useEffect(() => {
    const channelName = getChannelName();
    const channel = supabase.channel(channelName);
    setChannel(channel);

    // Presence for active users
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: any[] = [];
      Object.keys(state).forEach(key => {
        const presences = state[key];
        users.push(...presences);
      });
      setActiveUsers(users);
    });

    // Handle drawing events
    channel.on('broadcast', { event: 'draw_batch' }, (payload: any) => {
      if (payload.payload.userId === userId) return;
      
      const { points, color, userId: strokeUserId } = payload.payload;
      const context = contextRef.current;
      if (!context || points.length === 0) return;
      
      // Store the received stroke
      strokesRef.current.push({
        points: [...points],
        color,
        userId: strokeUserId
      });
      
      const currentStrokeStyle = context.strokeStyle;
      context.strokeStyle = color;
      
      let isNewPath = true;
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        if (point.type === 'start' || isNewPath) {
          context.beginPath();
          context.moveTo(point.x, point.y);
          isNewPath = false;
        } else if (point.type === 'move') {
          context.lineTo(point.x, point.y);
          context.stroke();
        }
      }
      
      context.strokeStyle = currentStrokeStyle;
    });

    // Handle individual drawing events
    channel.on('broadcast', { event: 'draw' }, (payload: any) => {
      if (payload.payload.userId === userId) return;
      
      const { x, y, type, color } = payload.payload;
      const context = contextRef.current;
      if (!context) return;
      
      const currentStrokeStyle = context.strokeStyle;
      context.strokeStyle = color;
      
      if (type === 'start') {
        context.beginPath();
        context.moveTo(x, y);
      } else if (type === 'move') {
        context.lineTo(x, y);
        context.stroke();
      }
      
      context.strokeStyle = currentStrokeStyle;
    });

    // Handle clear canvas event
    channel.on('broadcast', { event: 'clear' }, () => {
      const canvas = canvasRef.current;
      const context = contextRef.current;
      if (!context || !canvas) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      // Clear the strokes array
      strokesRef.current = [];
    });

    // Handle stroke request - send all strokes to the requester
    channel.on('broadcast', { event: 'request_strokes' }, (payload: any) => {
      if (payload.payload.userId === userId) return;
      
      // Only the user who has been in the room the longest should respond
      // This is a simple way to avoid flooding with multiple responses
      const users = channel.presenceState();
      let oldestUser = { online_at: Infinity, user_id: '' };
      
      Object.values(users).forEach((userList: any) => {
        userList.forEach((user: any) => {
          if (user.online_at < oldestUser.online_at) {
            oldestUser = user;
          }
        });
      });
      
      // If I'm the oldest user in the room, send my strokes
      if (oldestUser.user_id === userId && strokesRef.current.length > 0) {
        setTimeout(() => {
          channel.send({
            type: 'broadcast',
            event: 'send_strokes',
            payload: {
              userId: userId,
              strokes: strokesRef.current,
              requesterId: payload.payload.userId
            },
          });
        }, 500); // Small delay to ensure the requester is ready
      }
    });

    // Handle receiving all strokes
    channel.on('broadcast', { event: 'send_strokes' }, (payload: any) => {
      // Only process if I'm the requester
      if (payload.payload.requesterId !== userId) return;
      
      const { strokes } = payload.payload;
      if (!strokes || !strokes.length) return;
      
      // Update our strokes array
      strokesRef.current = [...strokes];
      
      // Redraw everything
      redrawAllStrokes();
    });

    // Subscribe to channel
    channel.subscribe(async (status: any) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: userId,
          username: username,
          online_at: new Date().getTime(),
        });
        setIsConnected(true);
        
        // Request existing strokes when joining
        requestExistingStrokes(channel);
      }
    });

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, userId, username, setActiveUsers, setIsConnected, setChannel, getChannelName]);

  // Send batched points
  const sendBatchedPoints = () => {
    if (pointsBuffer.length === 0) return;
    
    const channel = useWhiteboardStore.getState().channel;
    if (!channel) return;
    
    // Create a copy of the current points buffer
    const pointsToSend = [...pointsBuffer];
    
    // Add this stroke to our local storage
    strokesRef.current.push({
      points: pointsToSend,
      color: currentColor,
      userId: userId
    });
    
    channel.send({
      type: 'broadcast',
      event: 'draw_batch',
      payload: {
        userId: userId,
        points: pointsToSend,
        color: currentColor,
      },
    });
    
    clearPointsBuffer();
  };

  // Start drawing handler
  const startDrawing = ({ nativeEvent }: { nativeEvent: MouseEvent }) => {
    if (!contextRef.current) return;
    const { offsetX, offsetY } = nativeEvent as any;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    
    const point: Point = { type: 'start', x: offsetX, y: offsetY };
    addPointToBuffer(point);
    currentStrokeRef.current = [point];
    
    if (!batchTimerRef.current) {
      batchTimerRef.current = setInterval(sendBatchedPoints, 10);
    }
    
    const channel = useWhiteboardStore.getState().channel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'draw',
        payload: {
          userId: userId,
          type: 'start',
          x: offsetX,
          y: offsetY,
          color: currentColor,
        },
      });
    }
  };

  // Draw handler
  const draw = ({ nativeEvent }: { nativeEvent: MouseEvent }) => {
    if (!isDrawing || !contextRef.current) return;
    const { offsetX, offsetY } = nativeEvent as any;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
    
    const point: Point = { type: 'move', x: offsetX, y: offsetY };
    addPointToBuffer(point);
    currentStrokeRef.current.push(point);
    
    const channel = useWhiteboardStore.getState().channel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'draw',
        payload: {
          userId: userId,
          type: 'move',
          x: offsetX,
          y: offsetY,
          color: currentColor,
        },
      });
    }
  };

  // Stop drawing handler
  const stopDrawing = () => {
    if (!contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
    sendBatchedPoints();
    
    if (batchTimerRef.current) {
      clearInterval(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    
    clearCurrentPath();
    currentStrokeRef.current = [];
  };

  // Clear canvas handler
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    const channel = useWhiteboardStore.getState().channel;
    
    if (!context || !canvas || !channel) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Clear strokes array
    strokesRef.current = [];
    
    channel.send({
      type: 'broadcast',
      event: 'clear',
      payload: {
        userId: userId,
      },
    });
  };

  // Color options
  const colors = ['#3ecf8e', '#f43f5e', '#60a5fa', '#a78bfa', '#ffffff'];

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-white">
      {/* Toolbar */}
      <div className="flex items-center gap-4 absolute top-16 right-4 z-10">
        <button
          onClick={clearCanvas}
          className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-full transition-colors"
          title="Clear Canvas"
        >
          {/* <Trash2 strokeWidth={1.5} size={16} /> */}
          🗑️
        </button>
        <div className="flex gap-2">
          {colors.map((color) => (
            <div
              key={color}
              className="w-6 h-6 rounded-full cursor-pointer transition-transform hover:scale-110"
              style={{ 
                background: color,
                border: color === currentColor ? '2px solid white' : '2px solid transparent'
              }}
              onClick={() => setCurrentColor(color)}
            />
          ))}
        </div>
        <div className="flex -space-x-2 ml-2">
          {activeUsers.map((user, index) => (
            <div
              key={index}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800 text-zinc-200 text-sm font-medium border-2 border-zinc-900"
              title={user.username}
            >
              {user.username?.[0]?.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
      
      {/* Canvas */}
      <div className="flex-1 w-full h-full overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          className="w-full h-full cursor-crosshair bg-zinc-900"
        />
      </div>
    </div>
  );
} 