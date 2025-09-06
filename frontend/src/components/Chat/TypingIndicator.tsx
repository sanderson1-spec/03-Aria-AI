import React from 'react';
import { Bot } from 'lucide-react';

interface TypingIndicatorProps {
  characterName: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ characterName }) => {
  return (
    <div className="flex items-start space-x-3">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
        <Bot className="w-4 h-4 text-gray-600" />
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
