import React, { useState, useRef, useEffect } from 'react';

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

const ChatPage: React.FC = () => {
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoadingCharacters, setIsLoadingCharacters] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentChat?.messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  // Load characters when modal opens
  useEffect(() => {
    if (showNewChatModal && characters.length === 0) {
      loadCharacters();
    }
  }, [showNewChatModal]);

  // Load saved chats on component mount
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

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !currentChat) return;
    
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: 'user',
      timestamp: new Date()
    };
    
    const newMessages = [...currentChat.messages, userMessage];
    const updatedChat = { ...currentChat, messages: newMessages };
    setCurrentChat(updatedChat);
    setChats(prev => prev.map(chat => chat.id === currentChat.id ? updatedChat : chat));
    
    const messageContent = inputValue;
    setInputValue('');
    setIsTyping(true);
    
    try {
      // Call real API
      const response = await fetch('http://localhost:3001/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          sessionId: currentChat.id,
          userId: 'user-1',
          characterId: currentChat.characterId
        })
      });

      const data = await response.json();
      
      if (data.success) {
        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: data.data.aiResponse,
          sender: 'ai',
          timestamp: new Date()
        };
        const finalMessages = [...newMessages, aiMessage];
        const finalChat = { ...currentChat, messages: finalMessages };
        setCurrentChat(finalChat);
        setChats(prev => prev.map(chat => chat.id === currentChat.id ? finalChat : chat));
        
        // Update psychology state if provided
        if (data.data.psychologyState) {
          console.log('Psychology state updated:', data.data.psychologyState);
        }
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `Sorry, I encountered an error: ${data.error}`,
          sender: 'ai',
          timestamp: new Date()
        };
        const errorMessages = [...newMessages, errorMessage];
        const errorChat = { ...currentChat, messages: errorMessages };
        setCurrentChat(errorChat);
        setChats(prev => prev.map(chat => chat.id === currentChat.id ? errorChat : chat));
      }
    } catch (error) {
      console.error('API Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Sorry, I couldn't connect to the server. Please try again.",
        sender: 'ai',
        timestamp: new Date()
      };
      const errorMessages = [...newMessages, errorMessage];
      const errorChat = { ...currentChat, messages: errorMessages };
      setCurrentChat(errorChat);
      setChats(prev => prev.map(chat => chat.id === currentChat.id ? errorChat : chat));
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex">
      {/* Character Sidebar */}
      <div className="w-80 bg-gray-50 border-r flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Characters</h2>
            <div className="flex items-center space-x-1">
              {chats.length > 0 && (
                <button
                  onClick={clearAllChats}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Clear All Chats"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <button
                onClick={() => setShowNewChatModal(true)}
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title="New Chat"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
          {chats.length > 0 && (
            <p className="text-sm text-gray-500">{chats.length} active conversation{chats.length !== 1 ? 's' : ''}</p>
          )}
        </div>

        {/* Character List */}
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="font-medium text-gray-800 mb-1">No conversations yet</h3>
              <p className="text-sm text-gray-500 mb-3">Start chatting with a character</p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                New Chat
              </button>
            </div>
          ) : (
            <div className="p-2">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => switchToCharacterChat(chat.characterId)}
                  className={`w-full p-3 rounded-lg text-left hover:bg-white transition-colors mb-1 ${
                    currentChat?.id === chat.id 
                      ? 'bg-white border border-blue-200 shadow-sm' 
                      : 'hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <img
                      src={`/avatars/${chat.characterAvatar}`}
                      alt={chat.characterName}
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.characterName)}&background=random`;
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-medium truncate ${
                          currentChat?.id === chat.id ? 'text-blue-600' : 'text-gray-800'
                        }`}>
                          {chat.characterName}
                        </h3>
                        <span className="text-xs text-gray-500 flex-shrink-0">
                          {chat.messages.length > 1 ? `${chat.messages.length - 1} msg${chat.messages.length > 2 ? 's' : ''}` : 'New'}
                        </span>
                      </div>
                      {chat.messages.length > 1 && (
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {chat.messages[chat.messages.length - 1].sender === 'user' ? 'You: ' : `${chat.characterName}: `}
                          {chat.messages[chat.messages.length - 1].content}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
        {currentChat ? (
          <div className="flex items-center space-x-3">
            <img 
              src={`/avatars/${currentChat.characterAvatar}`}
              alt={currentChat.characterName}
              className="w-10 h-10 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentChat.characterName)}&background=random`;
              }}
            />
            <div>
              <h2 className="font-semibold text-gray-800">{currentChat.characterName}</h2>
              <p className="text-sm text-gray-500">AI Character</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600">
              💬
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">No Chat Selected</h2>
              <p className="text-sm text-gray-500">Create a new chat to get started</p>
            </div>
          </div>
        )}
        <div className="flex items-center space-x-2 text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-sm font-medium">Connected</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {currentChat ? (
          <>
            {currentChat.messages.map((message) => (
          <div key={message.id} className={`flex items-start space-x-3 ${
            message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''
          }`}>
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.sender === 'user' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
            }`}>
              {message.sender === 'user' ? '👤' : '🤖'}
            </div>
            
            {/* Message Bubble */}
            <div className={`max-w-xs lg:max-w-md xl:max-w-lg ${
              message.sender === 'user' ? 'items-end' : 'items-start'
            }`}>
              <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                message.sender === 'user'
                  ? 'bg-blue-500 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
              <div className={`text-xs text-gray-500 mt-1 ${
                message.sender === 'user' ? 'text-right' : 'text-left'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center flex-shrink-0">
                  🤖
                </div>
                <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md shadow-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">No Chat Selected</h3>
              <p className="text-gray-500 mb-4">Choose a character from the sidebar or create a new conversation</p>
              <div className="flex items-center justify-center text-sm text-gray-400">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Use the sidebar to get started
              </div>
            </div>
          </div>
        )}
        
        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white border-t p-4">
        <div className="relative">
          <div className="flex items-end space-x-3">
            {/* Growing Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentChat ? `Message ${currentChat.characterName}... (Press Enter to send, Shift+Enter for new line)` : "Select a character to start chatting..."}
                disabled={!currentChat}
                className={`w-full px-4 py-3 pr-12 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 min-h-[48px] max-h-[120px] overflow-y-auto ${!currentChat ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                style={{ height: '48px' }}
              />
              
              {/* Character count (optional) */}
              {inputValue.length > 100 && (
                <div className="absolute bottom-2 right-12 text-xs text-gray-400">
                  {inputValue.length}
                </div>
              )}
            </div>
            
            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isTyping || !currentChat}
              className={`p-3 rounded-full transition-all duration-200 flex items-center justify-center ${
                inputValue.trim() && !isTyping && currentChat
                  ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isTyping ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </button>
          </div>
          
          {/* Helper text */}
          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between">
            <span>💡 Tip: Use Shift+Enter for line breaks</span>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>AI Ready</span>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Character Selection Modal */}
      {showNewChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Choose a Character</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoadingCharacters ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-gray-600">Loading characters...</span>
              </div>
            ) : characters.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Characters Available</h3>
                <p className="text-gray-500 mb-4">Create some characters first to start chatting</p>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Go to Characters Page
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {characters.map((character) => (
                    <div
                      key={character.id}
                      onClick={() => createNewChat(character)}
                      className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center space-x-3 mb-3">
                        <img
                          src={`/avatars/${character.display}`}
                          alt={character.name}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(character.name)}&background=random`;
                          }}
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                            {character.name}
                          </h3>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-3 mb-3">
                        {character.description}
                      </p>
                      {character.definition && (
                        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
                          <p className="line-clamp-2">{character.definition}</p>
                        </div>
                      )}
                      <div className="mt-3 flex items-center justify-end">
                        <span className="text-xs text-blue-500 group-hover:text-blue-600 font-medium">
                          Start Chat →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
