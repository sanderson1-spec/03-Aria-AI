// Core application types
export interface User {
  id: string;
  username: string;
  email?: string;
}

export interface Character {
  id: string;
  name: string;
  tagline: string;
  description: string;
  definition: string;
  avatar?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatSession {
  id: string;
  userId: string;
  characterId: string;
  character: Character;
  lastMessage?: Message;
  lastActivity: Date;
  psychologyState?: PsychologyState;
}

export interface Message {
  id: string;
  sessionId: string;
  content: string;
  type: 'user' | 'ai' | 'system';
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    proactive?: boolean;
    psychologyTrigger?: string;
  };
}

export interface PsychologyState {
  mood: 'positive' | 'neutral' | 'negative' | 'curious' | 'frustrated' | 'excited';
  engagement: 'high' | 'moderate' | 'low';
  energy: number; // 0-100
  learningProgress?: {
    patternsIdentified: number;
    adaptationScore: number;
  };
}

export interface ProactiveMessage {
  id: string;
  sessionId: string;
  content: string;
  trigger: string;
  confidence: number;
  timestamp: Date;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'chat_message' | 'psychology_update' | 'proactive_message' | 'typing' | 'error';
  payload: any;
  sessionId?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// UI State types
export interface UIState {
  currentSessionId: string | null;
  isConnected: boolean;
  isTyping: boolean;
  sidebarOpen: boolean;
}
