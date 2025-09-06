import React, { useState } from 'react';

function App() {
  const [messages, setMessages] = useState<string[]>([
    "Hello! I'm Aria, your AI assistant. How can I help you today?"
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage = `You: ${inputValue}`;
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    const messageContent = inputValue;
    setInputValue('');
    setIsTyping(true);
    
    try {
      // Call real API
      const response = await fetch('http://localhost:3001/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          sessionId: 'session-1',
          userId: 'user-1',
          characterId: 'aria-1'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages([...newMessages, `Aria: ${data.data.aiResponse}`]);
        
        // Update psychology state if provided
        if (data.data.psychologyState) {
          // You could update UI psychology indicators here
          console.log('Psychology state updated:', data.data.psychologyState);
        }
      } else {
        setMessages([...newMessages, `Aria: Sorry, I encountered an error: ${data.error}`]);
      }
    } catch (error) {
      console.error('API Error:', error);
      setMessages([...newMessages, `Aria: Sorry, I couldn't connect to the server. Please try again.`]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg p-6">
        <h1 className="text-2xl font-bold text-blue-600 mb-6">Aria AI</h1>
        <nav className="space-y-2">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg font-medium">
            💬 Chat
          </div>
          <div className="p-3 text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">
            👥 Characters
          </div>
          <div className="p-3 text-gray-600 hover:bg-gray-50 rounded-lg cursor-pointer">
            ⚙️ Settings
          </div>
        </nav>
        
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-gray-800 mb-2">Psychology State</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Mood:</span>
              <span className="text-green-600">😊 Positive</span>
            </div>
            <div className="flex justify-between">
              <span>Engagement:</span>
              <span className="text-blue-600">High</span>
            </div>
            <div className="flex justify-between">
              <span>Energy:</span>
              <div className="w-16 bg-gray-200 rounded-full h-2 mt-1">
                <div className="bg-blue-500 h-2 rounded-full" style={{width: '75%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
            <div>
              <h2 className="font-semibold text-gray-800">Aria</h2>
              <p className="text-sm text-gray-500">AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium">Connected</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((message, index) => {
            const isUser = message.startsWith('You:');
            return (
              <div key={index} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  isUser 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white border border-gray-200 text-gray-800'
                }`}>
                  {message.replace(/^(You:|Aria:)\s*/, '')}
                </div>
              </div>
            );
          })}
          
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="bg-white border-t p-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Message Aria..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;