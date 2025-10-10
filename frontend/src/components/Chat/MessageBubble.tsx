import React from 'react';
import type { Message } from '../../types';
import { Bot, User, AlertCircle, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { formatChatTimestamp } from '../../utils/dateFormatter';
import ReactMarkdown from 'react-markdown';

interface MessageBubbleProps {
  message: Message;
  characterAvatar?: string;
  characterName?: string;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, characterAvatar, characterName }) => {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isProactive = message.metadata?.proactive;

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
        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden",
        isUser ? "bg-primary-500" : "bg-gradient-to-br from-purple-500 to-pink-500"
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : characterAvatar && characterAvatar !== 'default.png' ? (
          <img 
            src={characterAvatar.startsWith('http') ? characterAvatar : `/avatars/${characterAvatar}`}
            alt={characterName || 'Character'}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = characterName 
                ? `https://ui-avatars.com/api/?name=${encodeURIComponent(characterName)}&background=random`
                : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
            {characterName?.charAt(0).toUpperCase() || <Bot className="w-4 h-4 text-white" />}
          </div>
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
          
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc list-inside mb-2">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal list-inside mb-2">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ children }) => <code className="bg-black bg-opacity-10 px-1 py-0.5 rounded text-sm">{children}</code>,
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          
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
          {formatChatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
};
