import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChatProvider, useChatContext } from './contexts/ChatContext';
import { AuthProvider } from './contexts/AuthContext';
import Navigation from './components/Layout/Navigation';
import ChatPage from './components/Chat/ChatPage';
import CharactersPage from './components/Characters/CharactersPage';
import SettingsPage from './components/Settings/SettingsPage';
import LoginPage from './components/Auth/LoginPage';
import RegisterPage from './components/Auth/RegisterPage';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { API_BASE_URL } from './config/api';

const AppContent: React.FC = () => {
  const {
    chats,
    currentChat,
    switchToCharacterChat,
    deleteChat,
    setShowNewChatModal,
  } = useChatContext();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen md:h-screen bg-gray-100 md:flex md:overflow-hidden relative">
      {/* Mobile Header with Hamburger Menu */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b z-[100] px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-blue-600">Aria AI</h1>
        <div className="w-10"></div> {/* Spacer for centering */}
      </div>

      {/* Navigation Sidebar */}
      <Navigation
        chats={chats}
        currentChat={currentChat}
        onSwitchToChat={switchToCharacterChat}
        onDeleteChat={deleteChat}
        onCreateNewChat={() => setShowNewChatModal(true)}
        isMobileMenuOpen={isMobileMenuOpen}
        onCloseMobileMenu={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile Menu Overlay - after sidebar in DOM so it appears between sidebar and content */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-[60]"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="w-full md:flex-1 flex flex-col md:pt-0 pt-[57px] md:overflow-hidden relative z-10">
        <Routes>
          <Route path="/" element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } />
          <Route path="/characters" element={
            <ProtectedRoute>
              <CharactersPage />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </div>
  );
};

function App() {
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  // Refresh available LLM models on app mount
  useEffect(() => {
    const refreshModels = async () => {
      setIsRefreshingModels(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/llm/models`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          // Store models in localStorage for later use
          localStorage.setItem('aria-available-models', JSON.stringify(data));
          console.log('✅ LLM models refreshed successfully:', data);
        } else {
          console.warn('⚠️ Failed to refresh LLM models:', response.status, response.statusText);
        }
      } catch (error) {
        // Log error but don't block app startup
        console.warn('⚠️ Error refreshing LLM models (non-blocking):', error);
      } finally {
        setIsRefreshingModels(false);
      }
    };

    refreshModels();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected routes */}
          <Route path="/*" element={
            <ChatProvider>
              {isRefreshingModels && (
                <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">Refreshing models...</span>
                </div>
              )}
              <AppContent />
            </ChatProvider>
          } />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;