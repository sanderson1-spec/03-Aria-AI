import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';

interface Chat {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar: string;
  messages: any[]; // Use any[] for now to avoid circular type issues
  createdAt: Date;
}

interface CollapsibleConversationListProps {
  chats: Chat[];
  currentChat: Chat | null;
  onSwitchToChat: (characterId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onCreateNewChat: () => void;
  className?: string;
}

export const CollapsibleConversationList: React.FC<CollapsibleConversationListProps> = ({
  chats,
  currentChat,
  onSwitchToChat,
  onDeleteChat,
  onCreateNewChat,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Remember collapsed state in localStorage
  const storageKey = 'aria-conversation-list-expanded';

  useEffect(() => {
    const savedState = localStorage.getItem(storageKey);
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(isExpanded));
  }, [isExpanded]);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg ${className}`}>
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-100 transition-colors rounded-t-lg"
      >
        <div className="flex items-center justify-between w-full">
          <h2 className="font-semibold text-gray-800">Conversations</h2>
          <div className="flex items-center space-x-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCreateNewChat();
              }}
              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
              title="New Chat"
            >
              <Plus className="w-5 h-5" />
            </button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {/* Chat count */}
          {chats.length > 0 && (
            <div className="px-4 py-2 bg-gray-100">
              <p className="text-sm text-gray-500">
                {chats.length} active conversation{chats.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Chat List */}
          <div className="max-h-64 overflow-y-auto">
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
                  onClick={onCreateNewChat}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                >
                  New Chat
                </button>
              </div>
            ) : (
              <div className="p-2">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`relative group rounded-lg mb-1 ${
                      currentChat?.id === chat.id 
                        ? 'bg-white border border-blue-200 shadow-sm' 
                        : 'hover:bg-white hover:shadow-sm'
                    }`}
                  >
                    <button
                      onClick={() => onSwitchToChat(chat.characterId)}
                      className="w-full p-3 text-left transition-colors"
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
                        <div className="flex-1 min-w-0 pr-8">
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
                              {chat.messages[chat.messages.length - 1].type === 'user' ? 'You: ' : `${chat.characterName}: `}
                              {chat.messages[chat.messages.length - 1].content}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                    
                    {/* Individual Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete conversation with ${chat.characterName}?`)) {
                          onDeleteChat(chat.id);
                        }
                      }}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all border border-transparent hover:border-red-300"
                      title={`Delete this conversation with ${chat.characterName}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
