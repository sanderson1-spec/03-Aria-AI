import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

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
            timestamp: new Date(msg.timestamp)
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

  const clearAllChats = () => {
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
    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      characterId: character.id,
      characterName: character.name,
      characterAvatar: character.display,
      messages: [{
        id: '1',
        content: `Hello! I'm ${character.name}. ${character.description}`,
        sender: 'ai',
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
