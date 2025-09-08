import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { CollapsibleConversationList } from './CollapsibleConversationList';

interface Chat {
  id: string;
  characterId: string;
  characterName: string;
  characterAvatar: string;
  messages: any[]; // Use any[] for now to avoid circular type issues
  createdAt: Date;
}

interface NavigationProps {
  chats?: Chat[];
  currentChat?: Chat | null;
  onSwitchToChat?: (characterId: string) => void;
  onCreateNewChat?: () => void;
  onClearAllChats?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  chats = [],
  currentChat = null,
  onSwitchToChat = () => {},
  onCreateNewChat = () => {},
  onClearAllChats = () => {},
}) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Chat', icon: '💬' },
    { path: '/characters', label: 'Characters', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="w-80 bg-white shadow-lg p-6">
      <h1 className="text-2xl font-bold text-blue-600 mb-6">Aria AI</h1>
      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`block p-3 rounded-lg font-medium transition-colors duration-200 ${
              location.pathname === item.path
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="mr-2">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      
      {/* Conversation List - Only show on Chat page */}
      {location.pathname === '/' && (
        <div className="mt-6">
          <CollapsibleConversationList
            chats={chats}
            currentChat={currentChat}
            onSwitchToChat={onSwitchToChat}
            onCreateNewChat={onCreateNewChat}
            onClearAllChats={onClearAllChats}
          />
        </div>
      )}
    </div>
  );
};

export default Navigation;
