"use client";

import { useEffect, useRef, useState } from "react";
import useWhiteboardStore, { supabase, Point, User } from "@/app/store/useWhiteboardStore";
import Toolbar from "./Toolbar";

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
  tool: string;
}

// For shape drawing
interface ShapeData {
  startX: number;
  startY: number;
  width: number;
  height: number;
  color: string;
}

// Add TextData interface for managing text elements
interface TextData {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  isSelected: boolean;
}

export default function Whiteboard({ roomId }: WhiteboardProps) {
  const {
    username,
    isDrawing,
    currentColor,
    currentTool,
    userId,
    pointsBuffer,
    setIsConnected,
    setActiveUsers,
    setIsDrawing,
    setCurrentTool,
    addPointToBuffer,
    clearPointsBuffer,
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
  const [shapes, setShapes] = useState<ShapeData[]>([]);
  const [tempShape, setTempShape] = useState<ShapeData | null>(null);
  const [textElements, setTextElements] = useState<TextData[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [textInput, setTextInput] = useState<{visible: boolean, x: number, y: number, text: string, fontSize: number}>({
    visible: false,
    x: 0,
    y: 0,
    text: "",
    fontSize: 16
  });

  // Set up room ID when component mounts or room changes
  useEffect(() => {
    setRoomId(roomId);
    return () => {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current);
    };
  }, [roomId, setRoomId]);

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
      // Don't set strokeStyle here, it will be set in a separate useEffect
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
  }, []);

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
      
      // Handle different tools
      if (stroke.tool === 'pencil' || !stroke.tool) {
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
      }
      
      context.strokeStyle = currentStrokeStyle;
    });
    
    // Draw all saved shapes
    shapes.forEach(shape => {
      const currentStrokeStyle = context.strokeStyle;
      context.strokeStyle = shape.color;
      
      context.beginPath();
      context.rect(shape.startX, shape.startY, shape.width, shape.height);
      context.stroke();
      
      context.strokeStyle = currentStrokeStyle;
    });

    // Draw all text elements
    textElements.forEach(textEl => {
      const currentFillStyle = context.fillStyle;
      context.fillStyle = textEl.color;
      context.font = `${textEl.fontSize}px Arial`;
      context.fillText(textEl.text, textEl.x, textEl.y);

      // If selected, draw selection box
      if (textEl.isSelected) {
        const metrics = context.measureText(textEl.text);
        const height = textEl.fontSize;
        
        context.strokeStyle = '#2563eb'; // Blue selection box
        context.lineWidth = 1;
        context.setLineDash([3, 3]); // Dashed line
        
        // Draw selection box around text
        context.strokeRect(
          textEl.x - 4, 
          textEl.y - height + 4, 
          metrics.width + 8, 
          height + 8
        );
        
        // Draw drag handle
        context.fillStyle = '#2563eb';
        context.fillRect(textEl.x + metrics.width + 4, textEl.y - height/2, 6, 6);
        
        // Reset dash
        context.setLineDash([]);
        context.lineWidth = 5;
      }
      
      context.fillStyle = currentFillStyle;
    });
  };

  // Set up Supabase realtime connection
  useEffect(() => {
    const channelName = getChannelName();
    const channel = supabase.channel(channelName);
    setChannel(channel);

    // Helper function to request existing strokes when joining a room
    const requestExistingStrokes = () => {
      channel.send({
        type: 'broadcast',
        event: 'request_strokes',
        payload: {
          userId: userId,
          requestTime: new Date().getTime(),
        },
      });
    };

    // Presence for active users
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users: User[] = [];
      
      Object.values(state).forEach((presenceList: unknown) => {
        const typedPresenceList = presenceList as { user_id: string; username: string; online_at: number }[];
        users.push(...typedPresenceList.map(presence => ({
          user_id: presence.user_id,
          username: presence.username,
          online_at: presence.online_at
        })));
      });
      
      setActiveUsers(users);
    });

    // Handle drawing events
    channel.on('broadcast', { event: 'draw_batch' }, (payload: { payload: { userId: string; points: Point[]; color: string; tool: string } }) => {
      if (payload.payload.userId === userId) return;
      
      const { points, color, userId: strokeUserId, tool } = payload.payload;
      const context = contextRef.current;
      if (!context || points.length === 0) return;
      
      // Store the received stroke
      strokesRef.current.push({
        points: [...points],
        color,
        userId: strokeUserId,
        tool: tool || 'pencil'
      });
      
      if (tool === 'pencil' || !tool) {
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
      }
    });

    // Handle shape drawing events
    channel.on('broadcast', { event: 'draw_shape' }, (payload: { payload: { userId: string; shape: ShapeData; tool: string } }) => {
      if (payload.payload.userId === userId) return;
      
      const { shape } = payload.payload;
      setShapes(prev => [...prev, shape]);
      
      const context = contextRef.current;
      if (!context) return;
      
      const currentStrokeStyle = context.strokeStyle;
      context.strokeStyle = shape.color;
      
      context.beginPath();
      context.rect(shape.startX, shape.startY, shape.width, shape.height);
      context.stroke();
      
      context.strokeStyle = currentStrokeStyle;
    });

    // Handle text drawing events
    channel.on('broadcast', { event: 'draw_text' }, (payload: { payload: { userId: string; textData: TextData } }) => {
      if (payload.payload.userId === userId) return;
      
      const { textData } = payload.payload;
      setTextElements(prev => [...prev, {...textData, isSelected: false}]);
      redrawAllStrokes(); // Redraw everything to show the new text
    });

    // Handle individual drawing events
    channel.on('broadcast', { event: 'draw' }, (payload: { payload: { userId: string; type: 'start' | 'move'; x: number; y: number; color: string } }) => {
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
      setShapes([]);
      setTextElements([]);
    });

    // Handle stroke request - send all strokes to the requester
    channel.on('broadcast', { event: 'request_strokes' }, (payload: { payload: { userId: string; requestTime: number } }) => {
      if (payload.payload.userId === userId) return;
      
      // Only the user who has been in the room the longest should respond
      // This is a simple way to avoid flooding with multiple responses
      const users = channel.presenceState();
      let oldestUser = { online_at: Infinity, user_id: '' };
      
      Object.values(users).forEach((userList: unknown) => {
        const typedUserList = userList as { user_id: string; online_at: number }[];
        typedUserList.forEach((user) => {
          if (user.online_at < oldestUser.online_at) {
            oldestUser = user;
          }
        });
      });
      
      // If I'm not the oldest user, don't respond
      if (oldestUser.user_id !== userId) return;
      
      // Send back all strokes we have
      if (strokesRef.current.length > 0 || shapes.length > 0 || textElements.length > 0) {
        channel.send({
          type: 'broadcast',
          event: 'existing_strokes',
          payload: {
            userId,
            strokes: strokesRef.current,
            shapes: shapes,
            textElements: textElements.map(t => ({...t, isSelected: false})),
            requesterId: payload.payload.userId,
            requestTime: payload.payload.requestTime,
          },
        });
      }
    });
    
    // Handle receiving existing strokes
    channel.on('broadcast', { event: 'existing_strokes' }, (payload: { 
      payload: { 
        userId: string; 
        strokes: Stroke[]; 
        shapes: ShapeData[];
        textElements: TextData[];
        requesterId: string; 
        requestTime: number 
      } 
    }) => {
      // Only the requester should process this
      if (payload.payload.requesterId !== userId) return;
      
      const { strokes, shapes: receivedShapes, textElements: receivedTextElements } = payload.payload;
      
      // Store and draw all received strokes
      for (const stroke of strokes) {
        strokesRef.current.push(stroke);
        
        if (stroke.tool === 'pencil' || !stroke.tool) {
          const context = contextRef.current;
          if (!context) continue;
          
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
        }
      }
      
      // Draw received shapes
      setShapes(receivedShapes);
      for (const shape of receivedShapes) {
        const context = contextRef.current;
        if (!context) continue;
        
        const currentStrokeStyle = context.strokeStyle;
        context.strokeStyle = shape.color;
        
        context.beginPath();
        context.rect(shape.startX, shape.startY, shape.width, shape.height);
        context.stroke();
        
        context.strokeStyle = currentStrokeStyle;
      }

      // Handle received text elements
      if (receivedTextElements) {
        setTextElements(receivedTextElements.map(text => ({...text, isSelected: false})));
      }
      
      redrawAllStrokes();
    });
    
    // Set up the channel
    channel
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            username: username,
            online_at: new Date().getTime(),
          });
          setIsConnected(true);
          
          // Request existing strokes from other users
          requestExistingStrokes();
          
          // Set up point batching
          batchTimerRef.current = setInterval(sendBatchedPoints, 100); // Send points every 100ms
        }
      });
      
    return () => {
      channel.unsubscribe();
      if (batchTimerRef.current) {
        clearInterval(batchTimerRef.current);
      }
    };
  }, [roomId, userId, username, setIsConnected, setActiveUsers, setChannel, getChannelName, shapes, textElements]);

  const sendBatchedPoints = () => {
    const buffer = pointsBuffer.slice();
    if (buffer.length === 0) return;
    
    const channel = useWhiteboardStore.getState().channel;
    if (!channel) return;
    
    clearPointsBuffer();
    
    channel.send({
      type: 'broadcast',
      event: 'draw_batch',
      payload: {
        userId,
        points: buffer,
        color: currentColor,
        tool: currentTool,
      },
    });
  };

  const startDrawing = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const { offsetX, offsetY } = getPointerPosition(event);
    const context = contextRef.current;
    
    if (!context) return;

    // Check if clicked on a text element
    const clickedTextIndex = textElements.findIndex(text => {
      const metrics = context.measureText(text.text);
      const height = text.fontSize;
      return (
        offsetX >= text.x - 4 &&
        offsetX <= text.x + metrics.width + 8 &&
        offsetY >= text.y - height + 4 &&
        offsetY <= text.y + 8
      );
    });

    // If clicked on text, select it and don't start drawing
    if (clickedTextIndex >= 0) {
      const clickedTextId = textElements[clickedTextIndex].id;
      
      // If clicking on an already selected text, start dragging it
      if (selectedTextId === clickedTextId) {
        setIsDraggingText(true);
      } else {
        // Otherwise just select it
        // Deselect all texts
        setTextElements(prev => prev.map(text => ({...text, isSelected: false})));
        
        // Select the clicked text
        setTextElements(prev => prev.map((text, i) => 
          i === clickedTextIndex ? {...text, isSelected: true} : text
        ));
        
        setSelectedTextId(clickedTextId);
      }
      
      redrawAllStrokes();
      return;
    }

    // Deselect all texts when clicking elsewhere
    if (textElements.some(t => t.isSelected)) {
      setTextElements(prev => prev.map(text => ({...text, isSelected: false})));
      setSelectedTextId(null);
      redrawAllStrokes();
    }
    
    if (textInput.visible) return;
    
    if (currentTool === 'pencil') {
      context.beginPath();
      context.moveTo(offsetX, offsetY);
      
      setIsDrawing(true);
      addPointToBuffer({
        type: 'start',
        x: offsetX,
        y: offsetY,
      });
      
      // Track the current path
      currentStrokeRef.current = [{
        type: 'start',
        x: offsetX,
        y: offsetY,
      }];
    } else if (currentTool === 'square' || currentTool === 'rectangle') {
      setIsDrawing(true);
      setTempShape({
        startX: offsetX,
        startY: offsetY,
        width: 0,
        height: 0,
        color: currentColor
      });
    } else if (currentTool === 'text') {
      setTextInput({
        visible: true,
        x: offsetX,
        y: offsetY,
        text: "",
        fontSize: 16
      });
    }
  };

  const draw = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    // Only move text if we're actively dragging
    if (isDraggingText && selectedTextId) {
      const { offsetX, offsetY } = getPointerPosition(event);
      
      // Update the position of the selected text
      setTextElements(prev => prev.map(text => 
        text.id === selectedTextId 
          ? {...text, x: offsetX, y: offsetY} 
          : text
      ));
      
      // Redraw everything with the new text position
      redrawAllStrokes();
      return;
    }
    
    if (!isDrawing) return;
    
    const { offsetX, offsetY } = getPointerPosition(event);
    const context = contextRef.current;
    
    if (!context) return;
    
    if (currentTool === 'pencil') {
      context.lineTo(offsetX, offsetY);
      context.stroke();
      
      addPointToBuffer({
        type: 'move',
        x: offsetX,
        y: offsetY,
      });
      
      // Track the current path
      currentStrokeRef.current.push({
        type: 'move',
        x: offsetX,
        y: offsetY,
      });
    } else if ((currentTool === 'square' || currentTool === 'rectangle') && tempShape) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Calculate new dimensions
      const width = offsetX - tempShape.startX;
      const height = currentTool === 'square' 
        ? Math.sign(width) * Math.abs(width) // Force square by using width for both dimensions
        : offsetY - tempShape.startY;
      
      // Update tempShape
      setTempShape({
        ...tempShape,
        width,
        height
      });
      
      // Redraw canvas with temporary shape
      redrawCanvas();
    }
  };
  
  // Helper to redraw the canvas with the temporary shape
  const redrawCanvas = () => {
    const context = contextRef.current;
    const canvas = canvasRef.current;
    if (!context || !canvas || !tempShape) return;
    
    // Clear canvas and redraw all permanent content
    redrawAllStrokes();
    
    // Draw the temporary shape
    const currentStrokeStyle = context.strokeStyle;
    context.strokeStyle = tempShape.color;
    
    context.beginPath();
    context.rect(
      tempShape.startX, 
      tempShape.startY, 
      tempShape.width, 
      tempShape.height
    );
    context.stroke();
    
    context.strokeStyle = currentStrokeStyle;
  };

  const stopDrawing = () => {
    // Stop text dragging
    if (isDraggingText) {
      setIsDraggingText(false);
      return;
    }
    
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentTool === 'pencil') {
      // Store the completed stroke
      if (currentStrokeRef.current.length > 0) {
        strokesRef.current.push({
          points: [...currentStrokeRef.current],
          color: currentColor,
          userId,
          tool: currentTool
        });
        currentStrokeRef.current = [];
        redrawAllStrokes(); // Redraw after adding stroke
      }
    } else if ((currentTool === 'square' || currentTool === 'rectangle') && tempShape) {
      // Broadcast finished shape
      const channel = useWhiteboardStore.getState().channel;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'draw_shape',
          payload: {
            userId,
            shape: tempShape,
            tool: currentTool
          },
        });
      }
      
      // Save shape to local state
      setShapes(prev => [...prev, tempShape]);
      setTempShape(null);
      redrawAllStrokes(); // Redraw after adding shape
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!textInput.text.trim()) {
      setTextInput({ ...textInput, visible: false });
      return;
    }
    
    // Create a new text element
    const newTextElement: TextData = {
      id: Math.random().toString(36).substring(2, 9),
      x: textInput.x,
      y: textInput.y,
      text: textInput.text,
      color: currentColor,
      fontSize: textInput.fontSize,
      isSelected: false
    };
    
    // Add to local state - using callback to ensure we're working with the latest state
    setTextElements(prevElements => {
      const updatedElements = [...prevElements, newTextElement];
      
      // Broadcast text after state is updated
      const channel = useWhiteboardStore.getState().channel;
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'draw_text',
          payload: {
            userId,
            textData: newTextElement
          },
        });
      }
      
      return updatedElements;
    });
    
    // Clear text input
    setTextInput({ visible: false, x: 0, y: 0, text: "", fontSize: 16 });

    // Force redraw to show the new text immediately
    setTimeout(() => {
      redrawAllStrokes();
    }, 0);
  };

  const handleFontSizeChange = (size: number) => {
    if (selectedTextId) {
      // Update font size of selected text
      setTextElements(prev => prev.map(text => 
        text.id === selectedTextId 
          ? {...text, fontSize: size} 
          : text
      ));
      redrawAllStrokes();
    } else {
      // Update font size of text being created
      setTextInput(prev => ({...prev, fontSize: size}));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!context || !canvas) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    
    // Clear the strokes array
    strokesRef.current = [];
    setShapes([]);
    setTextElements([]);
    
    // Broadcast clear canvas
    const channel = useWhiteboardStore.getState().channel;
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'clear',
        payload: { userId },
      });
    }
  };

  // Updated getPointerPosition to handle different event types properly
  const getPointerPosition = (event: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { offsetX: 0, offsetY: 0 };
    
    // Handle touch event
    if ('touches' in event && event.touches.length) {
      const touch = event.touches[0];
      const rect = canvas.getBoundingClientRect();
      return {
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top
      };
    }
    
    // Handle mouse event
    if ('clientX' in event) {
      const rect = canvas.getBoundingClientRect();
      return {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top
      };
    }
    
    return { offsetX: 0, offsetY: 0 };
  };

  // Add effect to ensure canvas is redrawn when text elements change
  useEffect(() => {
    if (contextRef.current) {
      redrawAllStrokes();
    }
  }, [textElements, shapes]);

  return (
    <div className="w-full h-full relative">
      <Toolbar 
        selectedTool={currentTool}
        setSelectedTool={setCurrentTool}
      />
      
      {/* Text formatting controls - show when creating text or when text is selected */}
      {(textInput.visible || textElements.some(t => t.isSelected)) && (
        <div className="absolute right-4 top-16 bg-zinc-800 p-2 rounded-md border border-zinc-700 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm">Font size:</span>
            <select 
              value={selectedTextId 
                ? textElements.find(t => t.id === selectedTextId)?.fontSize || 16
                : textInput.fontSize
              }
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              className="bg-zinc-700 text-white text-sm rounded-md py-1 px-2"
            >
              {[10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(size => (
                <option key={size} value={size}>{size}px</option>
              ))}
            </select>

            {selectedTextId && (
              <button
                onClick={() => {
                  setTextElements(prev => prev.filter(t => t.id !== selectedTextId));
                  setSelectedTextId(null);
                  redrawAllStrokes();
                }}
                className="bg-red-600 text-white text-sm py-1 px-2 rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
      
      <button
        className="absolute right-4 top-4 bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-md flex items-center gap-2 shadow-lg"
        onClick={clearCanvas}
      >
        <span>Clear</span>
      </button>
      
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full bg-white touch-none"
      ></canvas>

      {textInput.visible && (
        <div 
          className="absolute bg-zinc-900 p-2 rounded-md shadow-lg"
          style={{ 
            left: textInput.x + 'px', 
            top: (textInput.y + 20) + 'px'
          }}
        >
          <form onSubmit={handleTextSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              value={textInput.text}
              onChange={(e) => setTextInput({...textInput, text: e.target.value})}
              autoFocus
              placeholder="Enter text..."
              className="px-2 py-1 bg-zinc-800 text-white border border-zinc-700 rounded-md"
            />
            <div className="flex gap-2 justify-end">
              <button 
                type="button"
                onClick={() => setTextInput({...textInput, visible: false})}
                className="bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded-md"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
} 