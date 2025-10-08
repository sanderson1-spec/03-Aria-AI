import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CollapsiblePsychologySection } from './CollapsiblePsychologySection';
import CommitmentPanel from './CommitmentPanel';
import EventsPanel from './EventsPanel';
import { useChatContext } from '../../contexts/ChatContext';
import { useProactiveMessages } from '../../hooks/useProactiveMessages';
import type { Message } from '../../types';
import { formatChatTimestamp } from '../../utils/dateFormatter';
import ReactMarkdown from 'react-markdown';
import { API_BASE_URL } from '../../config/api';

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

  // Handle proactive messages
  const handleProactiveMessage = useCallback((message: Message) => {
    if (!currentChat) return;
    
    console.log('📨 Handling proactive message:', message);
    
    // Normalize timestamp to Date object if it's a string
    const normalizedMessage = {
      ...message,
      timestamp: typeof message.timestamp === 'string' 
        ? new Date(message.timestamp) 
        : message.timestamp
    };
    
    // Add proactive message to current chat
    const updatedMessages = [...currentChat.messages, normalizedMessage];
    const updatedChat = { ...currentChat, messages: updatedMessages };
    
    setCurrentChat(updatedChat);
    setChats(prev => prev.map(chat => 
      chat.id === currentChat.id ? updatedChat : chat
    ));
  }, [currentChat, setCurrentChat, setChats]);

  // Setup proactive messaging connection
  const { isConnected: isProactiveConnected } = useProactiveMessages({
    sessionId: currentChat?.id || null,
    onProactiveMessage: handleProactiveMessage,
    enabled: !!currentChat
  });

  // Handle verification feedback messages
  const handleVerificationFeedback = useCallback((verificationData: {
    feedback: string;
    decision: 'approved' | 'needs_revision' | 'rejected' | 'not_verifiable' | 'pending';
    canResubmit: boolean;
    commitmentId: string;
    commitmentDescription: string;
    characterName: string;
  }) => {
    if (!currentChat) return;

    const verificationMessage: Message = {
      id: `verification-${Date.now()}`,
      sessionId: currentChat.id,
      content: verificationData.feedback,
      type: 'verification',
      timestamp: new Date(),
      metadata: {
        verification: {
          decision: verificationData.decision,
          canResubmit: verificationData.canResubmit,
          commitmentId: verificationData.commitmentId,
          commitmentDescription: verificationData.commitmentDescription
        }
      }
    };

    const updatedMessages = [...currentChat.messages, verificationMessage];
    const updatedChat = { ...currentChat, messages: updatedMessages };
    
    setCurrentChat(updatedChat);
    setChats(prev => prev.map(chat => 
      chat.id === currentChat.id ? updatedChat : chat
    ));
  }, [currentChat, setCurrentChat, setChats]);

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
      sessionId: currentChat.id,
      content: inputValue.trim(),
      type: 'user',
      timestamp: new Date()
    };
    
    const newMessages = [...currentChat.messages, userMessage];
    const updatedChat = { ...currentChat, messages: newMessages };
    setCurrentChat(updatedChat);
    setChats(prev => prev.map(chat => chat.id === currentChat.id ? updatedChat : chat));
    
    const messageContent = inputValue;
    setInputValue('');
    setIsTyping(true);
    
    // Create a streaming AI message placeholder
    const aiMessageId = (Date.now() + 1).toString();
    const streamingMessage: Message = {
      id: aiMessageId,
      sessionId: currentChat.id,
      content: '',
      type: 'ai',
      timestamp: new Date(),
      isStreaming: true
    };
    
    // Add streaming message placeholder
    const messagesWithStreaming = [...newMessages, streamingMessage];
    const chatWithStreaming = { ...currentChat, messages: messagesWithStreaming };
    setCurrentChat(chatWithStreaming);
    setChats(prev => prev.map(chat => chat.id === currentChat.id ? chatWithStreaming : chat));
    
    try {
      // Use fetch with streaming handling
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
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

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'chunk') {
                  fullContent = data.fullContent;
                  
                  // Update the streaming message with new content
                  setCurrentChat(prevChat => {
                    if (!prevChat) return prevChat;
                    
                    const updatedMessages = prevChat.messages.map(msg => 
                      msg.id === aiMessageId 
                        ? { ...msg, content: fullContent, isStreaming: true }
                        : msg
                    );
                    
                    const updatedChat = { ...prevChat, messages: updatedMessages };
                    setChats(prev => prev.map(chat => chat.id === prevChat.id ? updatedChat : chat));
                    return updatedChat;
                  });
                } else if (data.type === 'complete') {
                  // Mark streaming as complete
                  setCurrentChat(prevChat => {
                    if (!prevChat) return prevChat;
                    
                    const updatedMessages = prevChat.messages.map(msg => 
                      msg.id === aiMessageId 
                        ? { ...msg, content: data.fullResponse, isStreaming: false }
                        : msg
                    );
                    
                    const updatedChat = { ...prevChat, messages: updatedMessages };
                    setChats(prev => prev.map(chat => chat.id === prevChat.id ? updatedChat : chat));
                    return updatedChat;
                  });
                  
                  // Update psychology state if provided
                  if (data.psychologyState) {
                    console.log('Psychology state updated:', data.psychologyState);
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                // Skip malformed JSON
                console.warn('Failed to parse streaming data:', parseError);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Streaming API Error:', error);
      
      // Update the streaming message to show error
      setCurrentChat(prevChat => {
        if (!prevChat) return prevChat;
        
        const updatedMessages = prevChat.messages.map(msg => 
          msg.id === aiMessageId 
            ? { 
                ...msg, 
                content: "Sorry, I couldn't connect to the server. Please try again.",
                isStreaming: false 
              }
            : msg
        );
        
        const updatedChat = { ...prevChat, messages: updatedMessages };
        setChats(prev => prev.map(chat => chat.id === prevChat.id ? updatedChat : chat));
        return updatedChat;
      });
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
    <div className="flex-1 flex flex-col h-screen md:h-auto">
      {/* Header */}
      <div className="bg-white border-b p-3 md:p-4 flex items-center justify-between flex-shrink-0">
        {currentChat ? (
          <div className="flex items-center space-x-2 md:space-x-3">
            <img 
              src={`/avatars/${currentChat.characterAvatar}`}
              alt={currentChat.characterName}
              className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentChat.characterName)}&background=random`;
              }}
            />
            <div>
              <h2 className="font-semibold text-gray-800 text-sm md:text-base">{currentChat.characterName}</h2>
              <p className="text-xs md:text-sm text-gray-500">AI Character</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 md:space-x-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-sm md:text-base">
              💬
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 text-sm md:text-base">No Chat Selected</h2>
              <p className="text-xs md:text-sm text-gray-500 hidden md:block">Create a new chat to get started</p>
            </div>
          </div>
        )}
        <div className="flex items-center space-x-2 md:space-x-4">
          <div className="hidden md:flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">Connected</span>
          </div>
          {currentChat && (
            <div className={`flex items-center space-x-1 md:space-x-2 ${
              isProactiveConnected ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isProactiveConnected ? 'bg-blue-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-xs md:text-sm font-medium">
                {isProactiveConnected ? 'Proactive' : 'Off'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Psychology Section - Collapsible (Desktop only) */}
      {currentChat && (
        <CollapsiblePsychologySection
          characterName={currentChat.characterName}
          sessionId={currentChat.id}
          className="m-4 hidden md:block"
        />
      )}

      {/* Tasks and Events Panel */}
      {currentChat && (
        <div className="mx-2 my-2 md:m-4">
          <div className="flex flex-col md:flex-row gap-2 md:gap-4">
            <div className="flex-1">
              <h3 className="font-semibold mb-2 text-sm md:text-base">Tasks</h3>
              <CommitmentPanel 
                chatId={currentChat.id} 
                userId="user-1"
                onVerificationFeedback={handleVerificationFeedback}
              />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-2 text-sm md:text-base">Events</h3>
              <EventsPanel 
                chatId={currentChat.id} 
                userId="user-1"
              />
            </div>
          </div>
        </div>
      )}

      {/* Messages - Scrollable Area with Fixed Height */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 space-y-4 md:space-y-6"
           style={{ 
             maxHeight: 'calc(100vh - 400px)',
             minHeight: '200px'
           }}>
        {currentChat ? (
          <>
            {currentChat.messages.map((message) => {
              // Helper function to get verification styling
              const getVerificationStyle = (decision: string) => {
                switch (decision) {
                  case 'approved':
                    return {
                      bg: 'bg-green-50',
                      border: 'border-green-200',
                      icon: '✅',
                      iconColor: 'text-green-600'
                    };
                  case 'needs_revision':
                    return {
                      bg: 'bg-yellow-50',
                      border: 'border-yellow-200',
                      icon: '⚠️',
                      iconColor: 'text-yellow-600'
                    };
                  case 'rejected':
                    return {
                      bg: 'bg-red-50',
                      border: 'border-red-200',
                      icon: '❌',
                      iconColor: 'text-red-600'
                    };
                  case 'not_verifiable':
                    return {
                      bg: 'bg-gray-50',
                      border: 'border-gray-200',
                      icon: '🤷',
                      iconColor: 'text-gray-600'
                    };
                  default:
                    return {
                      bg: 'bg-blue-50',
                      border: 'border-blue-200',
                      icon: '⏳',
                      iconColor: 'text-blue-600'
                    };
                }
              };

              // Render verification message
              if (message.type === 'verification' && message.metadata?.verification) {
                const verificationStyle = getVerificationStyle(message.metadata.verification.decision);
                
                return (
                  <div key={message.id} className="flex items-start space-x-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white flex items-center justify-center flex-shrink-0">
                      🤖
                    </div>
                    
                    {/* Verification Message Bubble */}
                    <div className="max-w-xs lg:max-w-md xl:max-w-lg">
                      <div className={`px-4 py-3 rounded-2xl rounded-bl-md shadow-sm border ${verificationStyle.bg} ${verificationStyle.border}`}>
                        {/* Verification Header */}
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                          <span className={`text-lg ${verificationStyle.iconColor}`}>
                            {verificationStyle.icon}
                          </span>
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            Verification Feedback
                          </span>
                        </div>
                        
                        {/* Commitment Description */}
                        {message.metadata.verification.commitmentDescription && (
                          <div className="text-xs text-gray-600 mb-2 italic">
                            Re: "{message.metadata.verification.commitmentDescription}"
                          </div>
                        )}
                        
                        {/* Feedback Content */}
                        <div className="text-sm leading-relaxed text-gray-800">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                              em: ({ children }) => <em className="italic">{children}</em>,
                              ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                              ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                              li: ({ children }) => <li className="mb-1">{children}</li>,
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                        
                        {/* Resubmit Prompt */}
                        {message.metadata.verification.canResubmit && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <p className="text-xs text-gray-600 flex items-center gap-1">
                              <span>💡</span>
                              <span>You can revise and resubmit this commitment</span>
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Timestamp */}
                      <div className="text-xs text-gray-500 mt-1 text-left">
                        {formatChatTimestamp(message.timestamp)}
                      </div>
                    </div>
                  </div>
                );
              }

              // Render regular message
              return (
                <div key={message.id} className={`flex items-start space-x-2 md:space-x-3 ${
                  message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}>
                  {/* Avatar */}
                  <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm md:text-base ${
                    message.type === 'user' 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                  }`}>
                    {message.type === 'user' ? '👤' : '🤖'}
                  </div>
                  
                  {/* Message Bubble */}
                  <div className={`max-w-[75%] md:max-w-xs lg:max-w-md xl:max-w-lg ${
                    message.type === 'user' ? 'items-end' : 'items-start'
                  }`}>
                    <div className={`px-3 py-2 md:px-4 md:py-3 rounded-2xl shadow-sm ${
                      message.type === 'user' 
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                    }`}>
                      <div className="text-xs md:text-sm leading-relaxed">
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            em: ({ children }) => <em className="italic">{children}</em>,
                            ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                            li: ({ children }) => <li className="mb-1">{children}</li>,
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <div className={`text-xs text-gray-500 mt-1 ${
                      message.type === 'user' ? 'text-right' : 'text-left'
                    }`}>
                      {formatChatTimestamp(message.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            
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
      <div className="bg-white border-t p-2 md:p-4 flex-shrink-0">
        <div className="relative">
          <div className="flex items-end space-x-2 md:space-x-3">
            {/* Growing Textarea */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={currentChat ? `Message ${currentChat.characterName}...` : "Select a character to start chatting..."}
                disabled={!currentChat}
                className={`w-full px-3 py-2 md:px-4 md:py-3 pr-12 border border-gray-300 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 min-h-[44px] max-h-[120px] overflow-y-auto text-sm md:text-base ${!currentChat ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
                style={{ height: '44px' }}
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
              className={`p-2.5 md:p-3 rounded-full transition-all duration-200 flex items-center justify-center min-w-[44px] min-h-[44px] ${
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
          
          {/* Helper text - Desktop only */}
          <div className="mt-2 text-xs text-gray-500 hidden md:flex items-center justify-between">
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-4 md:p-6 w-full max-w-4xl max-h-[90vh] md:max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4 md:mb-6">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800">Choose a Character</h2>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoadingCharacters ? (
              <div className="flex items-center justify-center py-8 md:py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="ml-3 text-sm md:text-base text-gray-600">Loading characters...</span>
              </div>
            ) : characters.length === 0 ? (
              <div className="text-center py-8 md:py-12">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 md:w-8 md:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                  </svg>
                </div>
                <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-2">No Characters Available</h3>
                <p className="text-sm md:text-base text-gray-500 mb-4">Create some characters first to start chatting</p>
                <button
                  onClick={() => setShowNewChatModal(false)}
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm md:text-base min-h-[44px]"
                >
                  Go to Characters Page
                </button>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[65vh] md:max-h-[60vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {characters.map((character) => (
                    <div
                      key={character.id}
                      onClick={() => createNewChat(character)}
                      className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 hover:shadow-lg hover:border-blue-300 transition-all cursor-pointer group active:scale-95"
                    >
                      <div className="flex items-center space-x-3 mb-2 md:mb-3">
                        <img
                          src={`/avatars/${character.display}`}
                          alt={character.name}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(character.name)}&background=random`;
                          }}
                        />
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm md:text-base text-gray-800 group-hover:text-blue-600 transition-colors">
                            {character.name}
                          </h3>
                        </div>
                      </div>
                      <p className="text-xs md:text-sm text-gray-600 line-clamp-2 md:line-clamp-3 mb-2 md:mb-3">
                        {character.description}
                      </p>
                      {character.definition && (
                        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 mb-2">
                          <p className="line-clamp-2">{character.definition}</p>
                        </div>
                      )}
                      <div className="mt-2 md:mt-3 flex items-center justify-end">
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