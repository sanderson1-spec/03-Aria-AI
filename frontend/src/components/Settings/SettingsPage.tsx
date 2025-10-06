import React, { useState, useEffect } from 'react';

interface Model {
  id: string;
  object: string;
  owned_by: string;
}

interface LLMSettings {
  model: string;
  endpoint: string;
  temperature: number;
  maxTokens: number;
}

interface UISettings {
  theme: string;
  language: string;
}

interface Settings {
  llm: LLMSettings;
  ui: UISettings;
}

const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadSettings();
    loadModels();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/settings/current');
      const data = await response.json();
      
      if (data.success) {
        setSettings(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    }
  };

  const loadModels = async () => {
    try {
      const response = await fetch('http://localhost:3002/api/settings/models');
      const data = await response.json();
      
      if (data.success) {
        setModels(data.data.models);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      setMessage({ type: 'error', text: 'Failed to load available models' });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const response = await fetch('http://localhost:3002/api/settings/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings)
      });
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: data.note || 'Settings updated successfully' 
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const updateLLMSetting = (key: keyof LLMSettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      llm: {
        ...settings.llm,
        [key]: value
      }
    });
  };

  const updateUISetting = (key: keyof UISettings, value: any) => {
    if (!settings) return;
    
    setSettings({
      ...settings,
      ui: {
        ...settings.ui,
        [key]: value
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <span className="text-2xl mr-3">⚙️</span>
            Settings
          </h1>
          <p className="text-gray-600 mt-2">Configure your Aria AI experience</p>
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

        {settings && (
          <div className="space-y-6">
            {/* LLM Settings */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-lg mr-3">🤖</span>
                AI Model Settings
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  <select
                    value={settings.llm.model}
                    onChange={(e) => updateLLMSetting('model', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {models.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.id}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Available models from LM Studio
                  </p>
                </div>

                {/* Endpoint */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Endpoint
                  </label>
                  <input
                    type="text"
                    value={settings.llm.endpoint}
                    onChange={(e) => updateLLMSetting('endpoint', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="http://localhost:1234/v1/chat/completions"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    LM Studio API endpoint
                  </p>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature: {settings.llm.temperature}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.llm.temperature}
                    onChange={(e) => updateLLMSetting('temperature', parseFloat(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Conservative (0)</span>
                    <span>Creative (2)</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="8192"
                    step="100"
                    value={settings.llm.maxTokens}
                    onChange={(e) => updateLLMSetting('maxTokens', parseInt(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum response length (100-8192)
                  </p>
                </div>
              </div>
            </div>

            {/* UI Settings */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-lg mr-3">🎨</span>
                Interface Settings
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Theme
                  </label>
                  <select
                    value={settings.ui.theme}
                    onChange={(e) => updateUISetting('theme', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto</option>
                  </select>
                </div>

                {/* Language */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Language
                  </label>
                  <select
                    value={settings.ui.language}
                    onChange={(e) => updateUISetting('language', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="fr">Français</option>
                    <option value="de">Deutsch</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Connection Status */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="text-lg mr-3">🔗</span>
                Connection Status
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-green-800">API Server</p>
                    <p className="text-sm text-green-600">Connected</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-blue-800">LM Studio</p>
                    <p className="text-sm text-blue-600">Available</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <div>
                    <p className="font-medium text-purple-800">Database</p>
                    <p className="text-sm text-purple-600">Ready</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                onClick={saveSettings}
                disabled={saving}
                className={`px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
                  saving
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
                }`}
              >
                {saving ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
