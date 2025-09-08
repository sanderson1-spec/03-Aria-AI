import React from 'react';
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
    clearAllChats,
    setShowNewChatModal,
  } = useChatContext();

  return (
    <div className="min-h-screen bg-gray-100 flex">
      <Navigation
        chats={chats}
        currentChat={currentChat}
        onSwitchToChat={switchToCharacterChat}
        onCreateNewChat={() => setShowNewChatModal(true)}
        onClearAllChats={clearAllChats}
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
  return (
    <Router>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </Router>
  );
}

export default App;