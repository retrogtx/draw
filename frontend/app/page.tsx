'use client';

import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';

export default function DrawingApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(5);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [cursors, setCursors] = useState<Record<string, { x: number, y: number }>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  // Track if the canvas has pending changes to be saved
  const pendingChangesRef = useRef<boolean>(false);
  // Track if we've sent a snapshot already
  const sentSnapshotRef = useRef<boolean>(false);
  // Track connection and sync status
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'synced' | 'unsynced'>('unsynced');

  // Generate or retrieve user ID
  useEffect(() => {
    const storedUserId = localStorage.getItem('drawUserId');
    if (storedUserId) {
      setUserId(storedUserId);
    } else {
      const newUserId = nanoid(8);
      localStorage.setItem('drawUserId', newUserId);
      setUserId(newUserId);
    }
  }, []);

  // Create a new drawing session or join an existing one
  useEffect(() => {
    const initSession = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      let sessionIdFromUrl = urlParams.get('session');
      
      if (!sessionIdFromUrl) {
        try {
          const response = await fetch('http://localhost:8080/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          });
          const data = await response.json();
          sessionIdFromUrl = data.sessionId;
          
          // Update URL with session ID
          const newUrl = `${window.location.pathname}?session=${sessionIdFromUrl}`;
          window.history.pushState({ path: newUrl }, '', newUrl);
        } catch (error) {
          console.error('Failed to create session:', error);
          return;
        }
      }
      
      setSessionId(sessionIdFromUrl);
    };

    initSession();
  }, []);

  // Set up canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log('Canvas initialized');
    
    // Make the canvas fill its container with a fixed size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    
    // Store context reference immediately
    contextRef.current = context;
    
    // Add a white background to make the canvas visible
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = brushWidth;

    // After canvas setup, only mark as shared-capable, not as having pending changes
    // This prevents blank canvases from being shared
    sentSnapshotRef.current = true;
    pendingChangesRef.current = false;

    // Handle window resize
    const handleResize = () => {
      if (!canvas || !context) return;
      
      // Save current drawing
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      
      // Resize canvas
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      
      // Restore context properties and drawing
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = color;
      context.lineWidth = brushWidth;
      
      // First fill with white background
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      // Then restore the image
      context.putImageData(imageData, 0, 0);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update stroke style when color or brush width changes
  useEffect(() => {
    if (!contextRef.current) return;
    contextRef.current.strokeStyle = color;
    contextRef.current.lineWidth = brushWidth;
  }, [color, brushWidth]);

  // Periodically save canvas state
  useEffect(() => {
    if (!sessionId || !userId) return;
    
    const saveCanvasInterval = setInterval(() => {
      if (pendingChangesRef.current && canvasRef.current && socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        setSyncStatus('syncing');
        // Convert canvas to base64 image
        const dataUrl = canvasRef.current.toDataURL('image/png');
        
        // Send canvas snapshot
        socketRef.current.send(JSON.stringify({
          type: 'snapshot',
          sessionId,
          userId,
          data: dataUrl
        }));
        
        pendingChangesRef.current = false;
        sentSnapshotRef.current = true;
        setTimeout(() => setSyncStatus('synced'), 500);
      }
    }, 2000); // Save every 2 seconds if there are changes
    
    return () => clearInterval(saveCanvasInterval);
  }, [sessionId, userId]);

  // Connect to WebSocket when sessionId is available
  useEffect(() => {
    if (!sessionId || !userId) return;
    
    setConnectionStatus('connecting');
    const socket = new WebSocket('ws://localhost:8081');
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
      
      // Join the session
      socket.send(JSON.stringify({
        type: 'join',
        sessionId,
        userId
      }));

      // Request latest snapshot right after joining
      socket.send(JSON.stringify({
        type: 'request-snapshot',
        sessionId,
        userId,
        forUserId: userId
      }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'draw':
          drawRemoteStroke(message.data);
          break;
        case 'drawing-history':
          if (message.actions && Array.isArray(message.actions)) {
            console.log(`Received ${message.actions.length} history actions`);
            // Process all drawing actions in sequence
            message.actions.forEach((action: any) => {
              if (action.type === 'draw') {
                drawRemoteStroke(action.data);
              }
            });
          }
          break;
        case 'user-list':
          // Handle the list of existing users
          if (message.users && Array.isArray(message.users)) {
            console.log(`Received user list with ${message.users.length} users`);
            setOnlineUsers(prevUsers => {
              // Filter out duplicates
              const newUsers = message.users.filter(
                (id: string) => id !== userId && !prevUsers.includes(id)
              );
              return [...prevUsers, ...newUsers];
            });
          }
          break;
        case 'clear':
          // Another user cleared the canvas
          if (message.userId !== userId) {
            clearCanvasLocally();
          }
          break;
        case 'request-snapshot':
          // Someone requested our canvas state
          if (canvasRef.current && sentSnapshotRef.current && pendingChangesRef.current) {
            // Only send if we actually have content to share
            const dataUrl = canvasRef.current.toDataURL('image/png');
            
            // Send canvas snapshot directly to the requesting user
            socket.send(JSON.stringify({
              type: 'canvas-snapshot',
              sessionId,
              userId,
              forUserId: message.forUserId,
              data: dataUrl
            }));
          }
          break;
        case 'canvas-snapshot':
          // We received a canvas snapshot
          setSyncStatus('syncing');
          if (message.forUserId === userId || message.forUserId === 'all') {
            // Only apply the snapshot if we're the intended recipient
            // or if it's specifically marked for everyone
            applyCanvasSnapshot(message.data);
            setTimeout(() => setSyncStatus('synced'), 500);
          }
          break;
        case 'cursor':
          updateCursor(message.userId, message.data);
          break;
        case 'user-joined':
          if (message.userId !== userId) {
            setOnlineUsers(prev => [...prev, message.userId]);
            
            // If we have a canvas with content, send it to the new user ONLY
            // This prevents refreshing for all users
            if (canvasRef.current && sentSnapshotRef.current) {
              setTimeout(() => {
                const dataUrl = canvasRef.current!.toDataURL('image/png');
                socket.send(JSON.stringify({
                  type: 'canvas-snapshot',
                  sessionId,
                  userId,
                  forUserId: message.userId,  // Send only to the new user
                  data: dataUrl
                }));
              }, 500); // Small delay to ensure they're ready to receive
            }
          }
          break;
        case 'user-left':
          setOnlineUsers(prev => prev.filter(id => id !== message.userId));
          setCursors(prev => {
            const newCursors = { ...prev };
            delete newCursors[message.userId];
            return newCursors;
          });
          break;
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };

    socket.onclose = () => {
      console.log('WebSocket disconnected');
      setConnectionStatus('disconnected');
    };

    return () => {
      socket.close();
    };
  }, [sessionId, userId]);

  // Apply a canvas snapshot received from another user
  const applyCanvasSnapshot = (dataUrl: string) => {
    if (!contextRef.current || !canvasRef.current) return;
    
    // Don't apply if we already have content (we're not a new user)
    // This prevents canvas reset when getting snapshots after we've started drawing
    if (pendingChangesRef.current && sentSnapshotRef.current) {
      console.log('Ignoring snapshot as we already have content');
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      // Clear the canvas first
      contextRef.current!.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      // Add white background
      contextRef.current!.fillStyle = 'white';
      contextRef.current!.fillRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      // Draw the image
      contextRef.current!.drawImage(img, 0, 0);
      sentSnapshotRef.current = true;
    };
    img.src = dataUrl;
  };

  // Clear the canvas locally without broadcasting
  const clearCanvasLocally = () => {
    if (!contextRef.current || !canvasRef.current) return;
    
    contextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    // Add white background after clearing
    contextRef.current.fillStyle = 'white';
    contextRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    pendingChangesRef.current = true;
  };

  // Clear the canvas and broadcast to other users
  const clearCanvas = () => {
    clearCanvasLocally();
    
    // Broadcast clear action
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN && sessionId) {
      socketRef.current.send(JSON.stringify({
        type: 'clear',
        sessionId,
        userId
      }));
    }
  };

  // Prevent other button clicks from affecting the canvas
  const preventCanvasReset = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!contextRef.current) return;
    
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    
    sendDrawEvent(offsetX, offsetY, offsetX, offsetY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) return;
    
    const { offsetX, offsetY } = e.nativeEvent;
    contextRef.current.lineTo(offsetX, offsetY);
    contextRef.current.stroke();
    
    // Mark that we have pending changes to save
    pendingChangesRef.current = true;
    
    // Send the drawing data
    const prevX = e.nativeEvent.offsetX - e.nativeEvent.movementX;
    const prevY = e.nativeEvent.offsetY - e.nativeEvent.movementY;
    sendDrawEvent(offsetX, offsetY, prevX, prevY);
    
    // Send cursor position
    sendCursorPosition(offsetX, offsetY);
  };

  const endDrawing = () => {
    if (!contextRef.current) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  // Move cursor without drawing
  const moveCursor = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDrawing) return; // Already handling in draw function
    
    const { offsetX, offsetY } = e.nativeEvent;
    sendCursorPosition(offsetX, offsetY);
  };

  // WebSocket send functions
  const sendDrawEvent = (x: number, y: number, prevX: number, prevY: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !sessionId) return;
    
    socketRef.current.send(JSON.stringify({
      type: 'draw',
      sessionId,
      userId,
      data: {
        x,
        y,
        prevX,
        prevY,
        color,
        width: brushWidth
      }
    }));
  };

  const sendCursorPosition = (x: number, y: number) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN || !sessionId) return;
    
    socketRef.current.send(JSON.stringify({
      type: 'cursor',
      sessionId,
      userId,
      data: { x, y }
    }));
  };

  // Draw stroke from another user
  const drawRemoteStroke = (data: any) => {
    if (!contextRef.current) return;
    
    const { x, y, prevX, prevY, color: remoteColor, width: remoteWidth } = data;
    
    // Save current context state
    const currentColor = contextRef.current.strokeStyle;
    const currentWidth = contextRef.current.lineWidth;
    
    // Apply remote stroke styles
    contextRef.current.strokeStyle = remoteColor;
    contextRef.current.lineWidth = remoteWidth;
    
    // Draw the stroke
    contextRef.current.beginPath();
    contextRef.current.moveTo(prevX, prevY);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    contextRef.current.closePath();
    
    // Restore original context state
    contextRef.current.strokeStyle = currentColor;
    contextRef.current.lineWidth = currentWidth;
    
    // Mark that the canvas has changed
    pendingChangesRef.current = true;
    sentSnapshotRef.current = true; // Ensure we can share this canvas with new users
  };

  // Update remote cursor position
  const updateCursor = (remoteUserId: string, position: { x: number, y: number }) => {
    setCursors(prev => ({
      ...prev,
      [remoteUserId]: position
    }));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="p-4 bg-white shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold text-blue-600">Collaborative Drawing</h1>
        <div className="flex gap-4 items-center" onClick={preventCanvasReset}>
          <div className="flex items-center">
            <label htmlFor="color" className="mr-2 text-gray-700 font-medium">Color:</label>
            <input
              type="color"
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="cursor-pointer border border-gray-300 rounded h-8 w-10"
            />
          </div>
          <div className="flex items-center">
            <label htmlFor="brushWidth" className="mr-2 text-gray-700 font-medium">Width:</label>
            <input
              type="range"
              id="brushWidth"
              min="1"
              max="20"
              value={brushWidth}
              onChange={(e) => setBrushWidth(Number(e.target.value))}
              className="cursor-pointer w-24"
            />
            <span className="ml-1 text-sm text-gray-600">{brushWidth}px</span>
          </div>
          <button 
            onClick={clearCanvas}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors shadow-sm font-medium"
          >
            Clear Canvas
          </button>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
            <div className={`w-3 h-3 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <div className="text-sm font-medium">
              {sessionId ? `Session: ${sessionId.substring(0, 6)}` : 'Loading...'}
              {syncStatus === 'syncing' && <span className="ml-1 text-blue-500">(Syncing...)</span>}
            </div>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1 relative">
        <main className="flex-1 relative bg-white border-4 border-gray-200 m-4 rounded-md shadow-md overflow-hidden">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={(e) => isDrawing ? draw(e) : moveCursor(e)}
            onMouseUp={endDrawing}
            onMouseLeave={endDrawing}
            className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          />
          
          {/* Remote cursors */}
          {Object.entries(cursors).map(([remoteUserId, position]) => (
            <div
              key={remoteUserId}
              className="absolute w-5 h-5 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
              style={{ 
                left: position.x,
                top: position.y,
                backgroundColor: `hsl(${remoteUserId.charCodeAt(0) * 10 % 360}, 70%, 60%)`,
                borderRadius: '50%',
                border: '2px solid white',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.2)'
              }}
            >
              <div className="absolute top-5 left-2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                {remoteUserId.substring(0, 4)}
              </div>
            </div>
          ))}
        </main>
        
        <aside className="w-64 bg-white m-4 mr-4 rounded-md shadow-md border border-gray-200 p-4 overflow-y-auto">
          <h2 className="font-bold text-lg mb-4 text-gray-800 border-b pb-2">Online Users</h2>
          <ul className="space-y-2">
            <li className="p-2 bg-blue-50 rounded-md flex items-center">
              <span className="w-4 h-4 rounded-full bg-green-500 mr-2 border border-white"></span>
              <span className="font-medium">{userId.substring(0, 4)} (You)</span>
            </li>
            {onlineUsers.map(id => (
              <li key={id} className="p-2 bg-gray-50 rounded-md flex items-center">
                <span 
                  className="w-4 h-4 rounded-full mr-2 border border-white"
                  style={{ backgroundColor: `hsl(${id.charCodeAt(0) * 10 % 360}, 70%, 60%)` }}
                ></span>
                <span>{id.substring(0, 4)}</span>
              </li>
            ))}
          </ul>
          {onlineUsers.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">No other users online.</p>
          )}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Share this session:</p>
            <div className="flex">
              <input 
                type="text" 
                readOnly 
                value={window.location.href}
                className="flex-1 p-2 text-xs bg-gray-50 border border-gray-300 rounded-l truncate"
              />
              <button 
                className="bg-blue-500 text-white px-2 py-1 rounded-r text-sm"
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                }}
              >
                Copy
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
