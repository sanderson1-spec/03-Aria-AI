import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CollapsibleConversationList } from './CollapsibleConversationList';
import { useAuth } from '../../contexts/AuthContext';

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
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  const handleLogout = async () => {
    await logout();
    navigate('/login');
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

      {/* User Menu - Always at bottom */}
      <div className="mt-auto pt-6 border-t border-gray-200">
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{user?.displayName || 'User'}</p>
                <p className="text-xs text-gray-500">@{user?.username}</p>
              </div>
            </div>
            <svg 
              className={`w-5 h-5 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navigation;
