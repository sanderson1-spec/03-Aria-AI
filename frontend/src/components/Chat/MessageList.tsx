import React, { useEffect, useRef } from 'react';
import type { Message } from '../../types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  characterName: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isTyping,
  characterName,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-gray-500 text-lg">
              Start a conversation with {characterName}
            </p>
            <p className="text-gray-400 text-sm mt-2">
              Your messages will appear here
            </p>
          </div>
        </div>
      ) : (
        <>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {isTyping && (
            <TypingIndicator characterName={characterName} />
          )}
        </>
      )}
      
      <div ref={messagesEndRef} />
    </div>
  );
};
