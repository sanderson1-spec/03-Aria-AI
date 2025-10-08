import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Message } from '../types';
import { API_BASE_URL } from '../config/api';
import { useAuth } from './AuthContext';

interface Character {
  id: string;
  name: string;
  description: string;
  display: string;
  definition: string;
}

interface Chat {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar: string;
  messages: Message[];
  createdAt: Date;
}

interface ChatContextType {
  chats: Chat[];
  currentChat: Chat | null;
  characters: Character[];
  isLoadingCharacters: boolean;
  showNewChatModal: boolean;
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  setCurrentChat: React.Dispatch<React.SetStateAction<Chat | null>>;
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>;
  setIsLoadingCharacters: React.Dispatch<React.SetStateAction<boolean>>;
  setShowNewChatModal: React.Dispatch<React.SetStateAction<boolean>>;
  switchToCharacterChat: (characterId: string) => void;
  createNewChat: (character: Character) => void;
  deleteChat: (chatId: string) => void;
  clearAllChats: () => void;
  loadCharacters: () => Promise<void>;
  loadSavedChats: () => void;
  saveChatsToStorage: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
};

interface ChatProviderProps {
  children: ReactNode;
}

export const ChatProvider: React.FC<ChatProviderProps> = ({ children }) => {
  const { sessionToken, user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Load chats from database when user is authenticated
  useEffect(() => {
    if (user && sessionToken) {
      loadChatsFromDatabase();
    } else {
      // Clear chats when user logs out
      setChats([]);
      setCurrentChat(null);
      localStorage.removeItem('aria-chats');
      localStorage.removeItem('aria-current-chat-id');
    }
  }, [user, sessionToken]);

  // Auto-save chats to localStorage as cache (but database is source of truth)
  useEffect(() => {
    if (chats.length > 0) {
      saveChatsToStorage();
    } else {
      localStorage.removeItem('aria-chats');
    }
  }, [chats]);

  const loadChatsFromDatabase = async () => {
    if (!user || !sessionToken) {
      console.log('No user or session token, skipping chats load');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/user/${user.id}/chats/recent?limit=50`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load chats from database');
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Transform database chats to frontend format
        const transformedChats: Chat[] = await Promise.all(
          result.data.map(async (dbChat: any) => {
            // Load messages for each chat
            const messagesResponse = await fetch(
              `${API_BASE_URL}/api/chat/history/${dbChat.id}?userId=${user.id}`,
              {
                headers: {
                  'Authorization': `Bearer ${sessionToken}`
                }
              }
            );
            
            let messages: any[] = [];
            if (messagesResponse.ok) {
              const messagesData = await messagesResponse.json();
              messages = messagesData.success ? messagesData.data : [];
            }

            return {
              id: dbChat.id,
              characterId: dbChat.personality_id,
              characterName: dbChat.personality_name || dbChat.title,
              characterAvatar: dbChat.personality_display || 'default.png',
              messages: messages.map((msg: any) => ({
                id: msg.id,
                sessionId: msg.session_id || msg.chat_id || dbChat.id,
                content: msg.content || msg.message,
                type: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'ai' : 'system',
                timestamp: new Date(msg.created_at)
              })),
              createdAt: new Date(dbChat.created_at)
            };
          })
        );

        setChats(transformedChats);
        
        // Restore current chat from localStorage if it exists in the loaded chats
        const savedCurrentChatId = localStorage.getItem('aria-current-chat-id');
        if (savedCurrentChatId) {
          const restoredChat = transformedChats.find(chat => chat.id === savedCurrentChatId);
          if (restoredChat) {
            setCurrentChat(restoredChat);
          }
        }
      }
    } catch (error) {
      console.error('Error loading chats from database:', error);
      // Fallback to localStorage if database load fails
      loadSavedChatsFromLocalStorage();
    }
  };

  const loadSavedChatsFromLocalStorage = () => {
    try {
      const savedChats = localStorage.getItem('aria-chats');
      const savedCurrentChatId = localStorage.getItem('aria-current-chat-id');
      
      if (savedChats) {
        const parsedChats: Chat[] = JSON.parse(savedChats).map((chat: any) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          messages: chat.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            type: msg.type || (msg.sender === 'user' ? 'user' : msg.sender === 'ai' ? 'ai' : 'system'),
            sessionId: msg.sessionId || chat.id
          }))
        }));
        
        setChats(parsedChats);
        
        if (savedCurrentChatId) {
          const currentChat = parsedChats.find(chat => chat.id === savedCurrentChatId);
          if (currentChat) {
            setCurrentChat(currentChat);
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved chats from localStorage:', error);
    }
  };

  const loadSavedChats = loadSavedChatsFromLocalStorage;

  const saveChatsToStorage = () => {
    try {
      localStorage.setItem('aria-chats', JSON.stringify(chats));
      if (currentChat) {
        localStorage.setItem('aria-current-chat-id', currentChat.id);
      }
    } catch (error) {
      console.error('Error saving chats:', error);
    }
  };

  const deleteChat = async (chatId: string) => {
    console.log('🗑️ deleteChat called with chatId:', chatId);
    
    if (!sessionToken || !user) {
      console.error('No auth token or user');
      return;
    }
    
    try {
      // Call backend API to delete chat from database
      const response = await fetch(`${API_BASE_URL}/api/chat/${chatId}?userId=${user.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to delete chat from backend:', error);
        // Continue with frontend deletion even if backend fails
      } else {
        console.log('✅ Chat deleted from backend successfully');
      }
    } catch (error) {
      console.error('Error deleting chat from backend:', error);
      // Continue with frontend deletion even if backend fails
    }

    // Remove the specific chat from the list
    console.log('📝 Removing chat from frontend state...');
    const updatedChats = chats.filter(chat => chat.id !== chatId);
    setChats(updatedChats);
    
    // If the deleted chat was the current chat, clear current chat
    if (currentChat && currentChat.id === chatId) {
      console.log('🔄 Clearing current chat...');
      setCurrentChat(null);
      localStorage.removeItem('aria-current-chat-id');
    }
    
    console.log('✅ Chat deletion complete');
    // Note: localStorage update is handled by the auto-save useEffect
  };

  const clearAllChats = () => {
    console.log('🧹 clearAllChats called - DELETING ALL CHATS');
    setChats([]);
    setCurrentChat(null);
    localStorage.removeItem('aria-chats');
    localStorage.removeItem('aria-current-chat-id');
  };

  const loadCharacters = async () => {
    if (!sessionToken || !user) {
      console.log('No session token or user, skipping characters load');
      return;
    }
    
    setIsLoadingCharacters(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/characters?userId=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setCharacters(data.data);
      } else {
        console.error('Failed to load characters:', data.error);
      }
    } catch (error) {
      console.error('Error loading characters:', error);
    } finally {
      setIsLoadingCharacters(false);
    }
  };

  const createNewChat = async (character: Character) => {
    if (!user || !sessionToken) {
      console.error('Cannot create chat: No user or session token');
      return;
    }

    // Check if we already have a chat with this character
    const existingChat = chats.find(chat => chat.characterId === character.id);
    
    if (existingChat) {
      // Switch to existing chat
      setCurrentChat(existingChat);
      localStorage.setItem('aria-current-chat-id', existingChat.id);
      setShowNewChatModal(false);
      return;
    }

    // Create new chat
    const chatId = `chat-${Date.now()}`;
    const newChat: Chat = {
      id: chatId,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.display,
      messages: [{
        id: '1',
        sessionId: chatId,
        content: `Hello! I'm ${character.name}. ${character.description}`,
        type: 'ai',
        timestamp: new Date()
      }],
      createdAt: new Date()
    };
    
    // Update local state immediately for responsiveness
    setChats(prev => [...prev, newChat]);
    setCurrentChat(newChat);
    localStorage.setItem('aria-current-chat-id', newChat.id);
    setShowNewChatModal(false);

    // Save to database in the background
    try {
      await fetch(`${API_BASE_URL}/api/chat/user/${user.id}/chats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({
          chatId: chatId,
          title: `Chat with ${character.name}`,
          personalityId: character.id,
          metadata: {}
        })
      });
    } catch (error) {
      console.error('Failed to save chat to database:', error);
      // Chat is already in local state, so user can continue
    }
  };

  const switchToCharacterChat = (characterId: string) => {
    const chat = chats.find(chat => chat.characterId === characterId);
    if (chat) {
      setCurrentChat(chat);
      localStorage.setItem('aria-current-chat-id', chat.id);
    }
  };

  const value: ChatContextType = {
    chats,
    currentChat,
    characters,
    isLoadingCharacters,
    showNewChatModal,
    setChats,
    setCurrentChat,
    setCharacters,
    setIsLoadingCharacters,
    setShowNewChatModal,
    switchToCharacterChat,
    createNewChat,
    deleteChat,
    clearAllChats,
    loadCharacters,
    loadSavedChats,
    saveChatsToStorage,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};
