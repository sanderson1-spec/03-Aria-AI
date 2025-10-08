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
  type: 'user' | 'ai' | 'system' | 'verification';
  timestamp: Date;
  isStreaming?: boolean;
  metadata?: {
    proactive?: boolean;
    psychologyTrigger?: string;
    verification?: {
      decision: 'approved' | 'needs_revision' | 'rejected' | 'not_verifiable' | 'pending';
      canResubmit?: boolean;
      commitmentId?: string;
      commitmentDescription?: string;
    };
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

// Commitment and Verification types
export interface CommitmentVerification {
  decision: 'approved' | 'needs_revision' | 'rejected' | 'not_verifiable';
  feedback: string;
  timing_assessment?: 'plausible' | 'suspicious' | 'too_fast' | 'too_slow';
  quality_assessment?: 'excellent' | 'good' | 'acceptable' | 'poor' | 'unacceptable';
  detected_ai_generation?: boolean;
  verified_at: Date;
}

export interface Commitment {
  id: string;
  user_id: string;
  chat_id: string;
  character_id: string;
  description: string;
  commitment_type?: string;
  status: 'active' | 'submitted' | 'verified' | 'completed' | 'cancelled' | 'needs_revision' | 'rejected' | 'not_verifiable' | 'pending_verification';
  assigned_at?: string;
  due_at?: string;
  submission_content?: string;
  submitted_at?: string;
  verification_result?: string;
  verification_feedback?: string;
  verification_decision?: 'approved' | 'needs_revision' | 'rejected' | 'not_verifiable';
  verification_reasoning?: string;
  verified_at?: string;
  revision_count: number;
  character_notes?: string;
  created_at: string;
  updated_at: string;
  verification?: CommitmentVerification; // For immediate verification response
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
