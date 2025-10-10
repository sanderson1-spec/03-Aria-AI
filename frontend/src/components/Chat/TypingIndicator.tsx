import React from 'react';
import { Bot } from 'lucide-react';

interface TypingIndicatorProps {
  characterName: string;
  characterAvatar?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ characterName, characterAvatar }) => {
  return (
    <div className="flex items-start space-x-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {characterAvatar && characterAvatar !== 'default.png' ? (
          <img 
            src={characterAvatar.startsWith('http') ? characterAvatar : `/avatars/${characterAvatar}`}
            alt={characterName}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(characterName)}&background=random`;
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
            {characterName.charAt(0).toUpperCase() || <Bot className="w-4 h-4 text-white" />}
          </div>
        )}
      </div>

      {/* Typing Animation */}
      <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl">
        <div className="flex items-center space-x-1">
          <span className="text-sm text-gray-600">{characterName} is typing</span>
          <div className="flex space-x-1 ml-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
};
