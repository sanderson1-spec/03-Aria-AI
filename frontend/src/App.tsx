import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ChatProvider, useChatContext } from './contexts/ChatContext';
import Navigation from './components/Layout/Navigation';
import ChatPage from './components/Chat/ChatPage';
import CharactersPage from './components/Characters/CharactersPage';
import SettingsPage from './components/Settings/SettingsPage';

const AppContent: React.FC = () => {
  const {
    chats,
    currentChat,
    switchToCharacterChat,
    deleteChat,
    setShowNewChatModal,
  } = useChatContext();

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Navigation
        chats={chats}
        currentChat={currentChat}
        onSwitchToChat={switchToCharacterChat}
        onDeleteChat={deleteChat}
        onCreateNewChat={() => setShowNewChatModal(true)}
      />
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/characters" element={<CharactersPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
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
        const response = await fetch('http://localhost:3001/api/llm/models', {
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
      <ChatProvider>
        {isRefreshingModels && (
          <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Refreshing models...</span>
          </div>
        )}
        <AppContent />
      </ChatProvider>
    </Router>
  );
}

export default App;