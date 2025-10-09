import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface UserProfile {
  name: string;
  birthdate?: string;
  bio?: string;
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: { name?: string; birthdate?: string; bio?: string };
  onSave: (profile: UserProfile) => Promise<void>;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onSave
}) => {
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (isOpen) {
      setName(currentProfile.name || '');
      setBirthdate(currentProfile.birthdate || '');
      setBio(currentProfile.bio || '');
      setError(null);
    }
  }, [isOpen, currentProfile]);

  const showToastMessage = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const profile: UserProfile = {
        name: name.trim(),
        ...(birthdate && { birthdate }),
        ...(bio.trim() && { bio: bio.trim() })
      };

      await onSave(profile);
      showToastMessage('Profile saved successfully', 'success');
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save profile';
      showToastMessage(errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <>
      {/* Modal Overlay - Dark backdrop with animation */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={handleCancel}
      >
        {/* Modal Content - Centered floating card */}
        <div 
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>👤</span>
                  <span>User Profile</span>
                </h2>
                <p className="text-sm text-blue-50 mt-1">
                  Tell me about yourself so I can personalize our conversations
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-all duration-200"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Form - Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 text-red-800 border-l-4 border-red-500">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{error}</span>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base"
                autoFocus
              />
            </div>

            {/* Birthdate Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Birthdate <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <input
                type="date"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base"
              />
            </div>

            {/* Bio Field */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Bio <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={6}
                placeholder="Tell me about yourself! Include things like:&#10;• Marital status and family (e.g., married, 2 kids)&#10;• Occupation and work&#10;• Hobbies and interests&#10;• Dietary preferences or restrictions&#10;• Fitness goals or health considerations&#10;• Anything else you'd like me to remember"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base resize-none"
              />
              <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>This information helps me provide more personalized and relevant responses</span>
              </p>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="bg-gray-50 px-6 py-4 flex flex-col sm:flex-row gap-3 border-t border-gray-200">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 sm:flex-none sm:px-6 py-3 rounded-xl font-semibold border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`flex-1 sm:flex-none sm:px-8 py-3 rounded-xl font-semibold transition-all duration-200 ${
                saving
                  ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              {saving ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </div>
              ) : (
                'Save Profile'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[10000] animate-in slide-in-from-bottom-5 duration-300">
          <div className={`p-4 rounded-xl shadow-2xl max-w-md mx-auto sm:mx-0 ${
            toastType === 'success' 
              ? 'bg-green-50 text-green-800 border-2 border-green-500' 
              : 'bg-red-50 text-red-800 border-2 border-red-500'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                toastType === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}>
                <span className="text-white text-lg font-bold">
                  {toastType === 'success' ? '✓' : '✗'}
                </span>
              </div>
              <span className="text-sm font-medium flex-1">{toastMessage}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Use portal to render at document body level, escaping the sidebar DOM hierarchy
  return createPortal(modalContent, document.body);
};

export default UserProfileModal;

