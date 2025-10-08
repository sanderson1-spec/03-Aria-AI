import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Message } from '../types';

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
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // Load saved chats on mount
  useEffect(() => {
    loadSavedChats();
  }, []);

  // Auto-save chats whenever chats state changes
  useEffect(() => {
    if (chats.length > 0) {
      saveChatsToStorage();
    } else {
      // If no chats left, remove from localStorage
      localStorage.removeItem('aria-chats');
    }
  }, [chats]);

  const loadSavedChats = () => {
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
            // Handle legacy messages that might use 'sender' instead of 'type'
            type: msg.type || (msg.sender === 'user' ? 'user' : msg.sender === 'ai' ? 'ai' : 'system'),
            sessionId: msg.sessionId || chat.id
          }))
        }));
        
        setChats(parsedChats);
        
        // Restore current chat if it exists
        if (savedCurrentChatId) {
          const currentChat = parsedChats.find(chat => chat.id === savedCurrentChatId);
          if (currentChat) {
            setCurrentChat(currentChat);
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved chats:', error);
    }
  };

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
    
    try {
      // Call backend API to delete chat from database
      const response = await fetch(`http://localhost:3001/api/chat/${chatId}?userId=user-1`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
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
    setIsLoadingCharacters(true);
    try {
      const response = await fetch('http://localhost:3001/api/characters');
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

  const createNewChat = (character: Character) => {
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
    
    setChats(prev => [...prev, newChat]);
    setCurrentChat(newChat);
    localStorage.setItem('aria-current-chat-id', newChat.id);
    setShowNewChatModal(false);
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
