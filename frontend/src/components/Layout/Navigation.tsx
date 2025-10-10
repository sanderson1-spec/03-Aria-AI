import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CollapsibleConversationList } from './CollapsibleConversationList';
import { useAuth } from '../../contexts/AuthContext';
import UserProfileModal from '../UserProfile/UserProfileModal';
import { API_BASE_URL } from '../../config/api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string; birthdate?: string; bio?: string }>({ name: '', birthdate: '', bio: '' });
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load collapsed state from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aria-sidebar-collapsed');
    if (saved !== null) {
      setIsCollapsed(JSON.parse(saved));
    }
  }, []);

  // Save collapsed state to localStorage
  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('aria-sidebar-collapsed', JSON.stringify(newState));
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const token = localStorage.getItem('aria-session-token');
        const response = await fetch(`${API_BASE_URL}/api/users/profile?userId=${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        if (data.success) {
          setUserProfile(data.profile || {});
        }
      } catch (err) {
        console.error('Failed to load user profile:', err);
      }
    };
    
    loadProfile();
  }, [user]);

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

  const handleProfileSave = async (profile: { name: string; birthdate?: string; bio?: string }) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const token = localStorage.getItem('aria-session-token');
    const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        userId: user.id,
        profile 
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      setUserProfile(profile);
      setShowProfileModal(false);
    } else {
      throw new Error(data.error || 'Failed to save profile');
    }
  };

  return (
    <div className={`
      bg-white shadow-lg flex flex-col
      ${isCollapsed ? 'md:w-20' : 'md:w-80'} md:relative md:h-screen
      fixed top-0 left-0 h-full w-80 z-[70]
      transition-all duration-300 ease-in-out
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
    `}>
      {/* Collapse Toggle Button - Desktop only */}
      <button
        onClick={toggleCollapsed}
        className="hidden md:flex absolute -right-3 top-6 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full items-center justify-center shadow-lg transition-colors z-[110]"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Scrollable Content Wrapper */}
      <div className={`flex-1 overflow-y-auto ${isCollapsed ? 'md:p-3 md:pt-3' : 'md:p-6 md:pt-6'} p-6 pt-20`}>
        {/* Close button - Mobile only */}
        <div className="md:hidden flex items-center justify-between mb-6 fixed top-0 left-0 right-0 bg-white p-4 border-b z-10">
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
      {!isCollapsed && <h1 className="hidden md:block text-2xl font-bold text-blue-600 mb-6">Aria AI</h1>}
      {isCollapsed && <div className="hidden md:block text-2xl font-bold text-blue-600 text-center mb-6">A</div>}
      
      <nav className="space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            title={isCollapsed ? item.label : undefined}
            className={`block p-3 rounded-lg font-medium transition-colors duration-200 ${
              location.pathname === item.path
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-50'
            } ${isCollapsed ? 'md:flex md:justify-center md:text-xl' : ''}`}
          >
            <span className={isCollapsed ? '' : 'mr-2'}>{item.icon}</span>
            <span className={isCollapsed ? 'md:hidden' : ''}>{item.label}</span>
          </Link>
        ))}
      </nav>
      
      {/* Conversation List - Only show on Chat page and when not collapsed */}
      {location.pathname === '/' && !isCollapsed && (
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
            title={isCollapsed ? user?.displayName || 'User' : undefined}
            className={`w-full flex items-center p-3 rounded-lg hover:bg-gray-50 transition-colors ${
              isCollapsed ? 'md:justify-center' : 'justify-between'
            }`}
          >
            <div className={`flex items-center ${isCollapsed ? '' : 'space-x-3'}`}>
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
              {!isCollapsed && (
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{user?.displayName || 'User'}</p>
                  <p className="text-xs text-gray-500">@{user?.username}</p>
                </div>
              )}
            </div>
            {!isCollapsed && (
              <svg 
                className={`w-5 h-5 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>

          {/* Dropdown Menu */}
          {showUserMenu && (
            <div className={`absolute bottom-full mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-2 ${
              isCollapsed ? 'md:left-0 md:w-48' : 'left-0 right-0'
            }`}>
              <button
                onClick={() => {
                  setShowProfileModal(true);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>User Profile</span>
              </button>
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
      </div> {/* Close scrollable content wrapper */}

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentProfile={userProfile}
        onSave={handleProfileSave}
      />
    </div>
  );
};

export default Navigation;
