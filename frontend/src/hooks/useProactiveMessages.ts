import { useEffect, useRef, useCallback, useState } from 'react';
import type { Message } from '../types';

interface ProactiveMessageEvent {
  type: 'connected' | 'proactive-message' | 'heartbeat' | 'error';
  message?: Message;
  sessionId?: string;
  timestamp?: string;
  error?: string;
}

interface UseProactiveMessagesProps {
  sessionId: string | null;
  onProactiveMessage: (message: Message) => void;
  enabled?: boolean;
}

export const useProactiveMessages = ({
  sessionId,
  onProactiveMessage,
  enabled = true
}: UseProactiveMessagesProps) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Store latest callback ref to avoid dependency issues
  const onProactiveMessageRef = useRef(onProactiveMessage);
  useEffect(() => {
    onProactiveMessageRef.current = onProactiveMessage;
  }, [onProactiveMessage]);

  useEffect(() => {
    // Skip if disabled or no session
    if (!sessionId || !enabled) {
      // Cleanup existing connection
      if (eventSourceRef.current) {
        console.log('🧹 Cleaning up proactive connection for session:', currentSessionRef.current);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        currentSessionRef.current = null;
        setIsConnected(false);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      return;
    }

    // If already connected to the same session, skip
    if (eventSourceRef.current && currentSessionRef.current === sessionId) {
      console.log('✅ Already connected to session:', sessionId);
      return;
    }

    // Cleanup previous connection if switching sessions
    if (eventSourceRef.current) {
      console.log('🧹 Cleaning up proactive connection for session:', currentSessionRef.current);
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log('🔗 Attempting to connect proactive messaging for session:', sessionId, 'enabled:', enabled);

    try {
      const eventSource = new EventSource(
        `http://localhost:3002/api/chat/proactive/${sessionId}`,
        {
          withCredentials: false
        }
      );

      eventSource.onopen = () => {
        console.log(`🔗 Proactive message stream connected for session ${sessionId}`);
        setIsConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ProactiveMessageEvent = JSON.parse(event.data);
          
          switch (data.type) {
            case 'connected':
              console.log(`✅ Proactive message stream established for session ${sessionId}`);
              break;
              
            case 'proactive-message':
              if (data.message) {
                console.log('📨 Received proactive message:', data.message);
                onProactiveMessageRef.current(data.message);
              }
              break;
              
            case 'heartbeat':
              // Silent heartbeat to keep connection alive
              break;
              
            case 'error':
              console.error('❌ Proactive message stream error:', data.error);
              break;
              
            default:
              console.log('📡 Unknown proactive message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing proactive message event:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error(`❌ Proactive message stream error for session ${sessionId}:`, error);
        setIsConnected(false);
        
        // Don't attempt reconnect on error - let useEffect handle reconnection
        // This prevents infinite loops during connection failures
      };

      eventSourceRef.current = eventSource;
      currentSessionRef.current = sessionId;

    } catch (error) {
      console.error('Error establishing proactive message stream:', error);
      setIsConnected(false);
    }

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        console.log('🧹 Cleaning up proactive connection for session:', sessionId);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        currentSessionRef.current = null;
        setIsConnected(false);
      }
    };
  }, [sessionId, enabled]);

  return {
    isConnected,
    reconnect: () => {
      // Force reconnect by clearing current session ref
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      currentSessionRef.current = null;
      setIsConnected(false);
    },
    disconnect: () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        console.log('🧹 Manually disconnecting session:', currentSessionRef.current);
        eventSourceRef.current.close();
        eventSourceRef.current = null;
        currentSessionRef.current = null;
        setIsConnected(false);
      }
    }
  };
};
