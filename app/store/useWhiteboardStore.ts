import { create } from 'zustand'
import { createClient } from '@supabase/supabase-js'
import { RealtimeChannel } from '@supabase/supabase-js'
import { DrawingTool } from '../../components/Toolbar'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Base channel prefix
export const CHANNEL_PREFIX = 'whiteboard-room'

export interface Point {
  type: 'start' | 'move'
  x: number
  y: number
}

export interface User {
  user_id: string
  username: string
  online_at: number
}

interface WhiteboardState {
  username: string
  isConnected: boolean
  activeUsers: User[]
  isDrawing: boolean
  currentColor: string
  currentTool: DrawingTool
  pointsBuffer: Point[]
  userId: string
  currentPath: Point[]
  roomId: string
  channel: RealtimeChannel | null
  isClearing: boolean
  
  // Actions
  setUsername: (username: string) => void
  setIsConnected: (isConnected: boolean) => void
  setActiveUsers: (users: User[]) => void
  setIsDrawing: (isDrawing: boolean) => void
  setCurrentColor: (color: string) => void
  setCurrentTool: (tool: DrawingTool) => void
  addPointToBuffer: (point: Point) => void
  clearPointsBuffer: () => void
  setCurrentPath: (path: Point[]) => void
  addPointToCurrentPath: (point: Point) => void
  clearCurrentPath: () => void
  setRoomId: (roomId: string) => void
  setChannel: (channel: RealtimeChannel) => void
  setIsClearing: (isClearing: boolean) => void
  getChannelName: () => string
}

// Generate a random username
const generateRandomUsername = () => {
  const adjectives = ['Happy', 'Clever', 'Brave', 'Bright', 'Kind']
  const nouns = ['Panda', 'Tiger', 'Eagle', 'Dolphin', 'Fox']
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${
    nouns[Math.floor(Math.random() * nouns.length)]
  }${Math.floor(Math.random() * 100)}`
}

// Generate a random user ID
const generateUserId = () => Math.random().toString(36).substring(2, 15)

const useWhiteboardStore = create<WhiteboardState>((set, get) => ({
  username: generateRandomUsername(),
  isConnected: false,
  activeUsers: [],
  isDrawing: false,
  currentColor: '#3ecf8e',
  currentTool: 'pencil',
  pointsBuffer: [],
  userId: generateUserId(),
  currentPath: [],
  roomId: 'default',
  channel: null,
  isClearing: false,
  
  // Actions
  setUsername: (username) => set({ username }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setActiveUsers: (users) => set({ activeUsers: users }),
  setIsDrawing: (isDrawing) => set({ isDrawing }),
  setCurrentColor: (color) => set({ currentColor: color }),
  setCurrentTool: (tool) => set({ currentTool: tool }),
  addPointToBuffer: (point) => set((state) => ({ 
    pointsBuffer: [...state.pointsBuffer, point] 
  })),
  clearPointsBuffer: () => set({ pointsBuffer: [] }),
  setCurrentPath: (path) => set({ currentPath: path }),
  addPointToCurrentPath: (point) => set((state) => ({
    currentPath: [...state.currentPath, point]
  })),
  clearCurrentPath: () => set({ currentPath: [] }),
  setRoomId: (roomId) => set({ roomId }),
  setChannel: (channel) => set({ channel }),
  setIsClearing: (isClearing) => set({ isClearing }),
  getChannelName: () => `${CHANNEL_PREFIX}-${get().roomId}`
}))

export default useWhiteboardStore 