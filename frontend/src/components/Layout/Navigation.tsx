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
  onDeleteChat?: (chatId: string) => void;
  onCreateNewChat?: () => void;
  isMobileMenuOpen?: boolean;
  onCloseMobileMenu?: () => void;
}

const Navigation: React.FC<NavigationProps> = ({
  chats = [],
  currentChat = null,
  onSwitchToChat = () => {},
  onDeleteChat = () => {},
  onCreateNewChat = () => {},
  isMobileMenuOpen = false,
  onCloseMobileMenu = () => {}
}) => {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Chat', icon: '💬' },
    { path: '/characters', label: 'Characters', icon: '👥' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  const handleNavClick = () => {
    // Close mobile menu when navigating on mobile
    if (isMobileMenuOpen) {
      onCloseMobileMenu();
    }
  };

  const handleChatSwitch = (characterId: string) => {
    onSwitchToChat(characterId);
    // Close mobile menu after switching chat
    if (isMobileMenuOpen) {
      onCloseMobileMenu();
    }
  };

  return (
    <div className={`
      bg-white shadow-lg p-6 
      md:w-80 md:static md:translate-x-0
      fixed top-0 left-0 h-full w-80 z-50 
      transition-transform duration-300 ease-in-out
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      overflow-y-auto
    `}>
      {/* Close button - Mobile only */}
      <div className="md:hidden flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-blue-600">Aria AI</h1>
        <button
          onClick={onCloseMobileMenu}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Desktop header */}
      <h1 className="hidden md:block text-2xl font-bold text-blue-600 mb-6">Aria AI</h1>
      
      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
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
            onSwitchToChat={handleChatSwitch}
            onDeleteChat={onDeleteChat}
            onCreateNewChat={onCreateNewChat}
          />
        </div>
      )}
    </div>
  );
};

export default Navigation;
