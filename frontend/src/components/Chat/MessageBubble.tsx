import React from 'react';
import type { Message } from '../../types';
import { Bot, User, AlertCircle, Zap } from 'lucide-react';
import { clsx } from 'clsx';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isProactive = message.metadata?.proactive;

  const formatTime = (timestamp: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="bg-gray-100 text-gray-600 px-3 py-2 rounded-full text-sm flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span>{message.content}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={clsx(
      "flex items-start space-x-3",
      isUser ? "flex-row-reverse space-x-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <div className={clsx(
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
        isUser ? "bg-primary-500" : "bg-gray-300"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-gray-600" />
        )}
      </div>

      {/* Message Content */}
      <div className={clsx(
        "max-w-xs lg:max-w-md xl:max-w-lg",
        isUser ? "ml-auto" : "mr-auto"
      )}>
        <div className={clsx(
          "px-4 py-3 rounded-2xl",
          isUser
            ? "bg-primary-500 text-white"
            : "bg-white border border-gray-200 text-gray-800",
          message.isStreaming && "animate-pulse"
        )}>
          {/* Proactive indicator */}
          {isProactive && !isUser && (
            <div className="flex items-center space-x-1 mb-2 text-xs opacity-75">
              <Zap className="w-3 h-3" />
              <span>Proactive message</span>
            </div>
          )}
          
          <p className="whitespace-pre-wrap">{message.content}</p>
          
          {/* Psychology trigger info */}
          {message.metadata?.psychologyTrigger && !isUser && (
            <div className="mt-2 text-xs opacity-75 border-t border-gray-200 pt-2">
              Triggered by: {message.metadata.psychologyTrigger}
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={clsx(
          "text-xs text-gray-500 mt-1",
          isUser ? "text-right" : "text-left"
        )}>
          {formatTime(message.timestamp)}
        </div>
      </div>
    </div>
  );
};
