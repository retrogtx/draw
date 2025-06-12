import { WebSocketServer, WebSocket } from 'ws';
import { parse } from 'url';

const wss = new WebSocketServer({ port: 8081 });

// Store active sessions and their participants
const sessions: Record<string, Set<WebSocket>> = {};
const userSessions: Record<string, { sessionId: string, userId: string, hasSnapshot: boolean }> = {};

// Store drawing history for each session
const sessionDrawings: Record<string, any[]> = {};

// Types for messages
interface BaseMessage {
  type: string;
  sessionId: string;
  userId: string;
}

interface JoinSessionMessage extends BaseMessage {
  type: 'join';
}

interface DrawMessage extends BaseMessage {
  type: 'draw';
  data: {
    x: number;
    y: number;
    prevX: number;
    prevY: number;
    color: string;
    width: number;
  };
}

interface CursorMessage extends BaseMessage {
  type: 'cursor';
  data: {
    x: number;
    y: number;
  };
}

interface LeaveSessionMessage extends BaseMessage {
  type: 'leave';
}

interface SnapshotMessage extends BaseMessage {
  type: 'snapshot';
  data: string; // Base64 encoded canvas data
}

interface ClearMessage extends BaseMessage {
  type: 'clear';
}

interface CanvasSnapshotMessage extends BaseMessage {
  type: 'canvas-snapshot';
  data: string; // Base64 encoded canvas data
  forUserId: string;
}

type ClientMessage = JoinSessionMessage | DrawMessage | CursorMessage | LeaveSessionMessage | SnapshotMessage | ClearMessage | CanvasSnapshotMessage;

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', (message: string) => {
    try {
      const parsedMessage = JSON.parse(message) as ClientMessage;
      const { type, sessionId, userId } = parsedMessage;

      // Handle different message types
      switch (type) {
        case 'join':
          handleJoin(ws, sessionId, userId);
          break;
        case 'draw':
          // Store drawing action in history
          if (!sessionDrawings[sessionId]) {
            sessionDrawings[sessionId] = [];
          }
          sessionDrawings[sessionId].push(parsedMessage);
          broadcastToSession(sessionId, message, ws);
          break;
        case 'snapshot':
          // Save the latest canvas snapshot
          if (parsedMessage.data) {
            // Mark that this user has a snapshot
            const userSession = userSessions[ws.toString()];
            if (userSession) {
              userSession.hasSnapshot = true;
            }
            
            // Store the snapshot in the session, but don't clear drawing history
            // This line was causing drawings to disappear when new users join
            // sessionDrawings[sessionId] = []; // Clear old drawing history as we have a snapshot now
            
            // Don't broadcast the snapshot to all users automatically
            // Only send snapshots when explicitly requested by new users
            // This prevents canvas from refreshing for everyone
          }
          break;
        case 'cursor':
          broadcastToSession(sessionId, message, ws);
          break;
        case 'leave':
          handleLeave(ws);
          break;
        case 'clear':
          // Clear the drawing history
          if (sessionDrawings[sessionId]) {
            sessionDrawings[sessionId] = [];
          }
          broadcastToSession(sessionId, message, ws);
          break;
        case 'canvas-snapshot':
          // Forward the snapshot to the intended recipient or all users
          if (parsedMessage.forUserId) {
            if (parsedMessage.forUserId === 'all') {
              broadcastToSession(sessionId, message, null);
            } else {
              // Find the specific user to send to
              const targetUser = Array.from(sessions[sessionId] || []).find(client => 
                userSessions[client.toString()]?.userId === parsedMessage.forUserId
              );
              
              if (targetUser) {
                targetUser.send(message);
              }
            }
          }
          break;
        default:
          console.warn(`Unknown message type: ${type}`);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  ws.on('close', () => {
    handleLeave(ws);
  });
});

function handleJoin(ws: WebSocket, sessionId: string, userId: string) {
  // Create session if it doesn't exist
  if (!sessions[sessionId]) {
    sessions[sessionId] = new Set();
    sessionDrawings[sessionId] = [];
  }

  // Add user to session
  sessions[sessionId].add(ws);
  userSessions[ws.toString()] = { 
    sessionId, 
    userId,
    hasSnapshot: false
  };

  // Send existing drawing actions to the new user
  if (sessionDrawings[sessionId] && sessionDrawings[sessionId].length > 0) {
    const historyMessage = JSON.stringify({
      type: 'drawing-history',
      actions: sessionDrawings[sessionId],
      sessionId,
      userId: 'system'
    });
    ws.send(historyMessage);
  }

  // Send the list of all users in the session to the new user
  const allSessionUsers = Array.from(sessions[sessionId]).map(client => 
    userSessions[client.toString()]?.userId
  ).filter(id => id && id !== userId) as string[];

  // Send the user list to the new user
  if (allSessionUsers.length > 0) {
    const userListMessage = JSON.stringify({
      type: 'user-list',
      sessionId,
      userId: 'system',
      users: allSessionUsers
    });
    ws.send(userListMessage);
  }

  // Request canvas snapshot from any existing user
  const otherSessionUsers = Array.from(sessions[sessionId]);
  if (otherSessionUsers.length > 1) {
    // Find any other user to request a snapshot from
    const otherUser = otherSessionUsers.find(client => client !== ws);
    
    if (otherUser) {
      const requestSnapshotMsg = JSON.stringify({
        type: 'request-snapshot',
        forUserId: userId,
        sessionId,
        userId: 'system'
      });
      otherUser.send(requestSnapshotMsg);
    }
  }

  // Notify everyone in the session about the new user
  const joinNotification = JSON.stringify({
    type: 'user-joined',
    userId,
    sessionId,
    timestamp: Date.now()
  });

  broadcastToSession(sessionId, joinNotification, null);
  
  console.log(`User ${userId} joined session ${sessionId}`);
}

function handleLeave(ws: WebSocket) {
  const userSession = userSessions[ws.toString()];
  if (!userSession) return;

  const { sessionId, userId } = userSession;
  
  // Remove from session
  if (sessions[sessionId]) {
    sessions[sessionId].delete(ws);
    
    // If session is empty, clean it up
    if (sessions[sessionId].size === 0) {
      delete sessions[sessionId];
      delete sessionDrawings[sessionId];
    } else {
      // Notify others that user has left
      const leaveNotification = JSON.stringify({
        type: 'user-left',
        userId,
        sessionId,
        timestamp: Date.now()
      });
      
      broadcastToSession(sessionId, leaveNotification, null);
    }
  }
  
  // Clean up user session mapping
  delete userSessions[ws.toString()];
  console.log(`User ${userId} left session ${sessionId}`);
}

function broadcastToSession(sessionId: string, message: string, except: WebSocket | null) {
  const session = sessions[sessionId];
  if (!session) return;

  session.forEach(client => {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

console.log('WebSocket Server running on port 8081');
