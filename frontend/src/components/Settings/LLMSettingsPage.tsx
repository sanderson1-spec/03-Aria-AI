import React, { useState, useEffect } from 'react';

interface LLMModel {
  id: string;
  name: string;
}

interface LLMConfig {
  conversational?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    context_window_messages?: number;
  };
  analytical?: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
    context_window_messages?: number;
  };
}

interface GlobalConfig {
  conversational: LLMConfig['conversational'];
  analytical: LLMConfig['analytical'];
}

const LLMSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [serverType, setServerType] = useState<'lmstudio' | 'ollama' | 'openai' | 'custom'>('lmstudio');
  const [endpoint, setEndpoint] = useState('http://localhost:1234/v1');
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  
  const [conversationalModel, setConversationalModel] = useState('');
  const [conversationalTemp, setConversationalTemp] = useState(0.7);
  const [conversationalMaxTokens, setConversationalMaxTokens] = useState(2000);
  const [conversationalContextWindow, setConversationalContextWindow] = useState(30);
  
  const [analyticalModel, setAnalyticalModel] = useState('');
  const [analyticalTemp, setAnalyticalTemp] = useState(0.1);
  const [analyticalMaxTokens, setAnalyticalMaxTokens] = useState(4000);
  const [analyticalContextWindow, setAnalyticalContextWindow] = useState(30);
  
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadConfiguration();
    loadAvailableModels();
  }, []);

  const loadConfiguration = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/llm/config');
      const data = await response.json();
      
      if (data.success) {
        const config: { global: GlobalConfig; user?: LLMConfig } = data.data;
        
        // Load conversational settings
        if (config.user?.conversational) {
          setConversationalModel(config.user.conversational.model || '');
          setConversationalTemp(config.user.conversational.temperature ?? 0.7);
          setConversationalMaxTokens(config.user.conversational.max_tokens ?? 2000);
          setConversationalContextWindow(config.user.conversational.context_window_messages ?? 30);
        } else if (config.global?.conversational) {
          setConversationalModel(config.global.conversational.model || '');
          setConversationalTemp(config.global.conversational.temperature ?? 0.7);
          setConversationalMaxTokens(config.global.conversational.max_tokens ?? 2000);
          setConversationalContextWindow(config.global.conversational.context_window_messages ?? 30);
        }
        
        // Load analytical settings
        if (config.user?.analytical) {
          setAnalyticalModel(config.user.analytical.model || '');
          setAnalyticalTemp(config.user.analytical.temperature ?? 0.1);
          setAnalyticalMaxTokens(config.user.analytical.max_tokens ?? 4000);
          setAnalyticalContextWindow(config.user.analytical.context_window_messages ?? 30);
        } else if (config.global?.analytical) {
          setAnalyticalModel(config.global.analytical.model || '');
          setAnalyticalTemp(config.global.analytical.temperature ?? 0.1);
          setAnalyticalMaxTokens(config.global.analytical.max_tokens ?? 4000);
          setAnalyticalContextWindow(config.global.analytical.context_window_messages ?? 30);
        }
      } else {
        throw new Error(data.error || 'Failed to load configuration');
      }
    } catch (error) {
      console.error('Failed to load LLM configuration:', error);
      setMessage({ type: 'error', text: 'Failed to load LLM configuration' });
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableModels = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('http://localhost:3001/api/llm/models');
      const data = await response.json();
      
      if (data.success) {
        setAvailableModels(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to load models');
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
      setMessage({ type: 'error', text: 'Failed to load available models. Server may be offline.' });
      setAvailableModels([]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      const preferences: LLMConfig = {
        conversational: {
          model: conversationalModel,
          temperature: conversationalTemp,
          max_tokens: conversationalMaxTokens,
          context_window_messages: conversationalContextWindow
        },
        analytical: {
          model: analyticalModel,
          temperature: analyticalTemp,
          max_tokens: analyticalMaxTokens,
          context_window_messages: analyticalContextWindow
        }
      };

      const response = await fetch('http://localhost:3001/api/llm/config/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 1, // TODO: Get from auth context
          preferences
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'LLM settings saved successfully!' });
      } else {
        throw new Error(data.error || 'Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save LLM settings:', error);
      setMessage({ type: 'error', text: 'Failed to save LLM settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/llm/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      
      if (data.success && data.connected) {
        setMessage({ type: 'success', text: `✓ ${data.message || 'Connection successful!'}` });
        // Refresh models after successful connection
        await loadAvailableModels();
      } else {
        setMessage({ type: 'error', text: `✗ ${data.message || 'Connection failed'}` });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setMessage({ type: 'error', text: '✗ Failed to connect to LLM server' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading LLM settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                <span className="text-2xl mr-3">🤖</span>
                LLM Settings
              </h1>
              <p className="text-gray-600 mt-2">Configure your language model preferences</p>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl ${
                testing
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Server Configuration */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Server Configuration</h2>
          
          <div className="space-y-4">
            {/* Server Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Server Type
              </label>
              <select
                value={serverType}
                onChange={(e) => setServerType(e.target.value as any)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="lmstudio">LM Studio</option>
                <option value="ollama">Ollama</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            {/* Endpoint */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Endpoint
              </label>
              <input
                type="text"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="http://localhost:1234/v1"
              />
            </div>

            {/* Refresh Models Button */}
            <div className="flex items-center space-x-3">
              <button
                onClick={loadAvailableModels}
                disabled={refreshing}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  refreshing
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {refreshing ? 'Refreshing...' : '🔄 Refresh Models'}
              </button>
              <span className="text-sm text-gray-600">
                {availableModels.length} models available
              </span>
            </div>
          </div>
        </div>

        {/* Conversational Model Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            💬 Conversational Model (LLM1)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Used for character conversations and creative responses
          </p>
          
          <div className="space-y-4">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                value={conversationalModel}
                onChange={(e) => setConversationalModel(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a model...</option>
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {conversationalTemp.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={conversationalTemp}
                onChange={(e) => setConversationalTemp(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Precise (0.0)</span>
                <span>Balanced (0.5)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={conversationalMaxTokens}
                onChange={(e) => setConversationalMaxTokens(parseInt(e.target.value) || 0)}
                min="100"
                max="8000"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum length of generated responses (100-8000)
              </p>
            </div>

            {/* Context Window */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Context Window (messages)
              </label>
              <input
                type="number"
                value={conversationalContextWindow}
                onChange={(e) => setConversationalContextWindow(parseInt(e.target.value) || 30)}
                min="10"
                max="100"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of recent messages character can see. Larger models support more.
              </p>
            </div>
          </div>
        </div>

        {/* Analytical Model Settings */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            🔍 Analytical Model (LLM2)
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Used for background analysis, pattern detection, and insights
          </p>
          
          <div className="space-y-4">
            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                value={analyticalModel}
                onChange={(e) => setAnalyticalModel(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select a model...</option>
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Temperature: {analyticalTemp.toFixed(2)}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={analyticalTemp}
                onChange={(e) => setAnalyticalTemp(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Precise (0.0)</span>
                <span>Balanced (0.5)</span>
                <span>Creative (1.0)</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Max Tokens
              </label>
              <input
                type="number"
                value={analyticalMaxTokens}
                onChange={(e) => setAnalyticalMaxTokens(parseInt(e.target.value) || 0)}
                min="100"
                max="8000"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Maximum length for analysis results (100-8000)
              </p>
            </div>

            {/* Context Window */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Context Window (messages)
              </label>
              <input
                type="number"
                value={analyticalContextWindow}
                onChange={(e) => setAnalyticalContextWindow(parseInt(e.target.value) || 30)}
                min="10"
                max="100"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of recent messages character can see. Larger models support more.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-end space-x-3">
            <button
              onClick={handleSave}
              disabled={saving || !conversationalModel || !analyticalModel}
              className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl ${
                saving || !conversationalModel || !analyticalModel
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {saving ? 'Saving...' : '💾 Save Settings'}
            </button>
          </div>
          
          {(!conversationalModel || !analyticalModel) && (
            <p className="text-sm text-amber-600 mt-2 text-right">
              ⚠️ Please select both conversational and analytical models
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LLMSettingsPage;

