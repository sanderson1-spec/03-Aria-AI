import React from 'react';
import type { PsychologyState } from '../../types';
import { Brain, Heart, Zap, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

interface PsychologyIndicatorsProps {
  state: PsychologyState;
}

export const PsychologyIndicators: React.FC<PsychologyIndicatorsProps> = ({ state }) => {
  const getMoodColor = (mood: PsychologyState['mood']) => {
    switch (mood) {
      case 'positive':
      case 'excited':
        return 'bg-green-100 text-green-800';
      case 'curious':
        return 'bg-blue-100 text-blue-800';
      case 'frustrated':
      case 'negative':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEngagementColor = (engagement: PsychologyState['engagement']) => {
    switch (engagement) {
      case 'high':
        return 'bg-green-100 text-green-800';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getEnergyColor = (energy: number) => {
    if (energy >= 70) return 'bg-green-500';
    if (energy >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center space-x-4 text-sm">
      {/* Mood Indicator */}
      <div className="flex items-center space-x-2">
        <Heart className="w-4 h-4 text-gray-500" />
        <span className={clsx(
          'psychology-indicator',
          getMoodColor(state.mood)
        )}>
          {state.mood}
        </span>
      </div>

      {/* Engagement Level */}
      <div className="flex items-center space-x-2">
        <Zap className="w-4 h-4 text-gray-500" />
        <span className={clsx(
          'psychology-indicator',
          getEngagementColor(state.engagement)
        )}>
          {state.engagement} engagement
        </span>
      </div>

      {/* Energy Level */}
      <div className="flex items-center space-x-2">
        <Brain className="w-4 h-4 text-gray-500" />
        <div className="flex items-center space-x-2">
          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={clsx(
                'h-full transition-all duration-500',
                getEnergyColor(state.energy)
              )}
              style={{ width: `${state.energy}%` }}
            />
          </div>
          <span className="text-xs text-gray-600">{state.energy}%</span>
        </div>
      </div>

      {/* Learning Progress */}
      {state.learningProgress && (
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <span className="psychology-indicator bg-purple-100 text-purple-800">
            {state.learningProgress.patternsIdentified} patterns
          </span>
        </div>
      )}
    </div>
  );
};
