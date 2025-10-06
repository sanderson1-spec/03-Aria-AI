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
  const [isConnected, setIsConnected] = useState(false);

  const cleanup = useCallback(() => {
    console.log('🧹 Cleaning up proactive connection for session:', sessionId);
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, [sessionId]);

  const connect = useCallback(() => {
    console.log('🔗 Attempting to connect proactive messaging for session:', sessionId, 'enabled:', enabled, 'isConnected:', isConnected);
    
    if (!sessionId || !enabled) {
      console.log('❌ Cannot connect: missing sessionId or disabled');
      return;
    }

    // Don't cleanup if already connected to same session
    if (eventSourceRef.current && isConnected) {
      console.log('✅ Already connected, skipping reconnection');
      return;
    }

    cleanup();

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
                onProactiveMessage(data.message);
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
        
        // Attempt to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log(`🔄 Attempting to reconnect proactive message stream for session ${sessionId}`);
          connect();
        }, 5000); // Retry after 5 seconds
      };

      eventSourceRef.current = eventSource;

    } catch (error) {
      console.error('Error establishing proactive message stream:', error);
      setIsConnected(false);
    }
  }, [sessionId, enabled, onProactiveMessage, cleanup]);

  // Connect when sessionId changes or component mounts
  useEffect(() => {
    if (sessionId && enabled) {
      connect();
    } else {
      cleanup();
    }

    return cleanup;
  }, [sessionId, enabled, connect, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isConnected: isConnected,
    reconnect: connect,
    disconnect: cleanup
  };
};
