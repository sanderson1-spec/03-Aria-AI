import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '../../config/api';
import type { PsychologyState } from '../../types';

interface CollapsiblePsychologySectionProps {
  characterName: string;
  sessionId: string | null;
  className?: string;
}

export const CollapsiblePsychologySection: React.FC<CollapsiblePsychologySectionProps> = ({
  characterName,
  sessionId,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [psychologyState, setPsychologyState] = useState<PsychologyState | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Remember collapsed state in localStorage
  const storageKey = 'aria-psychology-section-expanded';

  useEffect(() => {
    const savedState = localStorage.getItem(storageKey);
    if (savedState !== null) {
      setIsExpanded(JSON.parse(savedState));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Fetch psychology state when sessionId changes
  useEffect(() => {
    if (sessionId && isExpanded) {
      fetchPsychologyState();
    }
  }, [sessionId, isExpanded]);

  const fetchPsychologyState = async () => {
    if (!sessionId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat/psychology/${sessionId}`);
      const data = await response.json();
      
      if (data.success) {
        setPsychologyState(data.data);
      } else {
        console.error('Failed to fetch psychology state:', data.error);
      }
    } catch (error) {
      console.error('Error fetching psychology state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const getMoodEmoji = (mood: PsychologyState['mood']) => {
    switch (mood) {
      case 'positive': return '😊';
      case 'excited': return '🤩';
      case 'curious': return '🤔';
      case 'frustrated': return '😤';
      case 'negative': return '😔';
      default: return '😐';
    }
  };

  const getEngagementDots = (engagement: PsychologyState['engagement']) => {
    const totalDots = 4;
    let activeDots = 0;
    
    switch (engagement) {
      case 'high': activeDots = 4; break;
      case 'moderate': activeDots = 2; break;
      case 'low': activeDots = 1; break;
      default: activeDots = 2;
    }

    return Array.from({ length: totalDots }, (_, i) => (
      <div
        key={i}
        className={`w-2 h-2 rounded-full ${
          i < activeDots ? 'bg-blue-500' : 'bg-gray-300'
        }`}
      />
    ));
  };

  if (!sessionId) {
    return null;
  }

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-100 ${className}`}>
      {/* Header */}
      <button
        onClick={toggleExpanded}
        className="w-full p-4 flex items-center justify-between hover:bg-blue-50/50 transition-colors rounded-xl"
      >
        <h3 className="font-semibold text-gray-800 flex items-center">
          🧠 {characterName}'s Mind
        </h3>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-2 text-sm text-gray-600">Loading...</span>
            </div>
          ) : psychologyState ? (
            <div className="space-y-3 text-sm">
              {/* Mood */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Mood:</span>
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{getMoodEmoji(psychologyState.mood)}</span>
                  <span className="text-green-600 font-medium capitalize">
                    {psychologyState.mood}
                  </span>
                </div>
              </div>

              {/* Engagement */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Engagement:</span>
                <div className="flex items-center space-x-2">
                  <div className="flex space-x-1">
                    {getEngagementDots(psychologyState.engagement)}
                  </div>
                  <span className="text-blue-600 font-medium text-xs capitalize">
                    {psychologyState.engagement}
                  </span>
                </div>
              </div>

              {/* Energy */}
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Energy:</span>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${psychologyState.energy}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    {psychologyState.energy}%
                  </span>
                </div>
              </div>

              {/* Learning Progress */}
              {psychologyState.learningProgress && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Learning:</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">📚</span>
                    <span className="text-purple-600 font-medium">
                      {psychologyState.learningProgress.patternsIdentified} patterns
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-gray-500">
              No psychology data available
            </div>
          )}
        </div>
      )}
    </div>
  );
};
