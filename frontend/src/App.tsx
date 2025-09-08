import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Layout/Navigation';
import ChatPage from './components/Chat/ChatPage';
import CharactersPage from './components/Characters/CharactersPage';
import SettingsPage from './components/Settings/SettingsPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex">
        <Navigation />
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/characters" element={<CharactersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;