import React, { useState, useEffect } from 'react';

interface Character {
  id: string;
  name: string;
  display: string;
  description: string;
  definition: string;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  llm_preferences?: {
    conversational?: {
      model?: string;
      temperature?: number;
      max_tokens?: number;
    };
  };
}

interface LLMModel {
  id: string;
  name: string;
}


const CharactersPage: React.FC = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCharacters();
  }, []);

  const loadCharacters = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/characters');
      const data = await response.json();
      
      if (data.success) {
        setCharacters(data.data);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to load characters:', error);
      setMessage({ type: 'error', text: 'Failed to load characters' });
    } finally {
      setLoading(false);
    }
  };


  const deleteCharacter = async (characterId: string) => {
    if (!confirm('Are you sure you want to delete this character?')) return;
    
    try {
      const response = await fetch(`http://localhost:3001/api/characters/${characterId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        setCharacters(characters.filter(c => c.id !== characterId));
        setMessage({ type: 'success', text: 'Character deleted successfully' });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to delete character:', error);
      setMessage({ type: 'error', text: 'Failed to delete character' });
    }
  };

  const exportCharacter = async (characterId: string) => {
    try {
      const response = await fetch(`http://localhost:3001/api/characters/${characterId}/export?userId=default-user`);
      const data = await response.json();
      
      // Create a blob from the JSON data
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      
      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.character.name.replace(/[^a-zA-Z0-9]/g, '_')}_character_export.json`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setMessage({ type: 'success', text: 'Character exported successfully' });
    } catch (error) {
      console.error('Failed to export character:', error);
      setMessage({ type: 'error', text: 'Failed to export character' });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileContent = await file.text();
      const importData = JSON.parse(fileContent);

      const response = await fetch('http://localhost:3001/api/characters/import?userId=default-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(importData)
      });

      const data = await response.json();

      if (data.success) {
        await loadCharacters();
        const warningMessage = data.warnings && data.warnings.length > 0 
          ? ` (${data.warnings.join(', ')})` 
          : '';
        setMessage({ 
          type: 'success', 
          text: `Character imported successfully${warningMessage}` 
        });
      } else {
        throw new Error(data.error || 'Failed to import character');
      }
    } catch (error) {
      console.error('Failed to import character:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to import character' 
      });
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading characters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                <span className="text-2xl mr-3">👥</span>
                Characters
              </h1>
              <p className="text-gray-600 mt-2">Create and manage your AI characters</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleImportClick}
                className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl flex items-center"
              >
                <span className="mr-2">📥</span>
                Import
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                + Create Character
              </button>
            </div>
          </div>
          {/* Hidden file input for import */}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleFileImport}
            className="hidden"
          />
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

        {/* Characters Grid */}
        {characters.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-6xl mb-4">🎭</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No characters yet</h3>
            <p className="text-gray-600 mb-6">Create your first AI character to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200"
            >
              Create Your First Character
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => {
              return (
                <div key={character.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
                  {/* Character Avatar */}
                  <div className="h-32 bg-gradient-to-br from-blue-500 to-purple-600 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      {character.display && character.display !== 'default.png' ? (
                        <img 
                          src={character.display} 
                          alt={character.name}
                          className="w-16 h-16 rounded-full object-cover border-4 border-white shadow-lg"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-2xl font-bold text-gray-600">
                          {character.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    {/* Usage indicator */}
                    <div className="absolute top-3 right-3 bg-white bg-opacity-90 rounded-full px-2 py-1 text-xs font-medium text-gray-700">
                      {character.usage_count} chats
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Character Info */}
                    <div className="mb-3">
                      <h3 className="text-lg font-semibold text-gray-800 mb-1">{character.name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{character.description}</p>
                    </div>

                    {/* Background preview */}
                    {character.definition && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Background:</p>
                        <p className="text-sm text-gray-700 line-clamp-2">{character.definition}</p>
                      </div>
                    )}

                    {/* Status */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${character.is_active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="text-xs text-gray-600">
                          {character.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(character.updated_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="space-y-2">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingCharacter(character)}
                          className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => exportCharacter(character.id)}
                          className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                        >
                          📥 Export
                        </button>
                      </div>
                      <button
                        onClick={() => deleteCharacter(character.id)}
                        className="w-full bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || editingCharacter) && (
          <CharacterModal
            character={editingCharacter}
            onClose={() => {
              setShowCreateModal(false);
              setEditingCharacter(null);
            }}
            onSave={() => {
              loadCharacters();
              setShowCreateModal(false);
              setEditingCharacter(null);
              setMessage({ 
                type: 'success', 
                text: editingCharacter ? 'Character updated successfully' : 'Character created successfully' 
              });
            }}
          />
        )}
      </div>
    </div>
  );
};

// Character Modal Component
interface CharacterModalProps {
  character: Character | null;
  onClose: () => void;
  onSave: () => void;
}

const CharacterModal: React.FC<CharacterModalProps> = ({ character, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: character?.name || '',
    description: character?.description || '',
    background: '',
    avatar: ''
  });
  const [saving, setSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState<LLMModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  
  // LLM override state
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [customModel, setCustomModel] = useState('');
  const [customTemperature, setCustomTemperature] = useState(0.7);
  const [customMaxTokens, setCustomMaxTokens] = useState(2000);

  useEffect(() => {
    if (character) {
      setFormData({
        name: character.name,
        description: character.description,
        background: character.definition || '',
        avatar: character.display !== 'default.png' ? character.display : ''
      });
      
      // Load LLM preferences if they exist
      if (character.llm_preferences?.conversational) {
        setUseCustomModel(true);
        setCustomModel(character.llm_preferences.conversational.model || '');
        setCustomTemperature(character.llm_preferences.conversational.temperature ?? 0.7);
        setCustomMaxTokens(character.llm_preferences.conversational.max_tokens ?? 2000);
      } else {
        // Reset LLM preferences if character doesn't have them
        setUseCustomModel(false);
        setCustomModel('');
        setCustomTemperature(0.7);
        setCustomMaxTokens(2000);
      }
    } else {
      // Reset all form data for new character
      setFormData({
        name: '',
        description: '',
        background: '',
        avatar: ''
      });
      setUseCustomModel(false);
      setCustomModel('');
      setCustomTemperature(0.7);
      setCustomMaxTokens(2000);
    }
    
    // Load available models
    loadAvailableModels();
  }, [character]);
  
  const loadAvailableModels = async () => {
    setLoadingModels(true);
    try {
      const response = await fetch('http://localhost:3001/api/llm/models');
      const data = await response.json();
      
      if (data.success) {
        setAvailableModels(data.data || []);
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Character name is required');
      return;
    }

    setSaving(true);
    
    try {
      const url = character 
        ? `http://localhost:3001/api/characters/${character.id}`
        : 'http://localhost:3001/api/characters';
      
      const method = character ? 'PUT' : 'POST';
      
      // Build request body with optional llm_preferences
      const requestBody: any = { ...formData };
      
      if (useCustomModel && customModel) {
        requestBody.llm_preferences = {
          conversational: {
            model: customModel,
            temperature: customTemperature,
            max_tokens: customMaxTokens
          }
        };
      } else {
        // Set to null to clear any existing preferences
        requestBody.llm_preferences = null;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSave();
      } else {
        throw new Error(data.error || data.details);
      }
    } catch (error) {
      console.error('Failed to save character:', error);
      alert(`Failed to save character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-800">
            {character ? 'Edit Character' : 'Create New Character'}
          </h2>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Avatar Preview */}
          <div className="text-center mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              {formData.avatar && formData.avatar.trim() ? (
                <img 
                  src={formData.avatar} 
                  alt="Avatar"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {formData.name.charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Character Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter character name"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Brief description of the character"
            />
          </div>

          {/* Background */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background & Personality
            </label>
            <textarea
              value={formData.background}
              onChange={(e) => setFormData({ ...formData, background: e.target.value })}
              rows={6}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Detailed background information, personality traits, speaking style, etc."
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Avatar URL (optional)
            </label>
            <input
              type="url"
              value={formData.avatar}
              onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/avatar.jpg"
            />
          </div>

          {/* LLM Override Section */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="useCustomModel"
                checked={useCustomModel}
                onChange={(e) => setUseCustomModel(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <label htmlFor="useCustomModel" className="ml-2 text-sm font-medium text-gray-700">
                🤖 Use custom model for this character
              </label>
            </div>
            
            <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              ℹ️ <strong>Note:</strong> Only the conversational model can be customized per character. The analytical model always uses the global configuration.
            </div>

            {useCustomModel && (
              <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model
                  </label>
                  {loadingModels ? (
                    <div className="text-sm text-gray-500">Loading models...</div>
                  ) : (
                    <select
                      value={customModel}
                      onChange={(e) => setCustomModel(e.target.value)}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Select a model...</option>
                      {availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature: {customTemperature.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={customTemperature}
                    onChange={(e) => setCustomTemperature(parseFloat(e.target.value))}
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
                    value={customMaxTokens}
                    onChange={(e) => setCustomMaxTokens(parseInt(e.target.value) || 0)}
                    min="100"
                    max="8000"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum response length (100-8000)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.name.trim()}
            className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
              saving || !formData.name.trim()
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {saving ? 'Saving...' : character ? 'Update Character' : 'Create Character'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharactersPage;
