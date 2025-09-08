import React, { useState, useRef, useEffect } from 'react';
import { CollapsiblePsychologySection } from './CollapsiblePsychologySection';
import { useChatContext } from '../../contexts/ChatContext';

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ChatPage: React.FC = () => {
  const {
    currentChat,
    setCurrentChat,
    setChats,
    characters,
    showNewChatModal,
    setShowNewChatModal,
    isLoadingCharacters,
    createNewChat,
    loadCharacters,
  } = useChatContext();

  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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
  }, [showNewChatModal, characters.length, loadCharacters]);

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

      {/* Psychology Section - Collapsible */}
      {currentChat && (
        <CollapsiblePsychologySection
          characterName={currentChat.characterName}
          sessionId={currentChat.id}
          className="m-4"
        />
      )}

      {/* Messages - Scrollable Area with Fixed Height */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(100vh - 300px)' }}>
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

      {/* Input Area - Fixed at bottom */}
      <div className="bg-white border-t p-4 flex-shrink-0">
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