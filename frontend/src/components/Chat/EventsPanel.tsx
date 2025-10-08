import React, { useState, useEffect } from 'react';
import { formatRelativeTime, formatDateTime } from '../../utils/dateFormatter';
import type { Event } from '../../types';
import { API_BASE_URL } from '../../config/api';

interface EventsPanelProps {
  chatId: string;
  userId: string;
}

const EventsPanel: React.FC<EventsPanelProps> = ({ chatId, userId }) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, [chatId, userId]);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/events/upcoming?chatId=${chatId}&userId=${userId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to load events');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const getRecurrenceIcon = (recurrenceType: string): string => {
    if (recurrenceType === 'once') {
      return '📅';
    }
    return '🔄';
  };

  const getRecurrenceLabel = (recurrenceType: string): string => {
    switch (recurrenceType) {
      case 'once':
        return 'One-time';
      case 'daily':
        return 'Daily';
      case 'weekly':
        return 'Weekly';
      case 'monthly':
        return 'Monthly';
      default:
        return recurrenceType;
    }
  };

  const getStatusBadgeColor = (status: string): string => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'missed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled';
      case 'completed':
        return 'Completed';
      case 'missed':
        return 'Missed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  };

  const formatNextOccurrence = (nextOccurrence: string): string => {
    const relativeTime = formatRelativeTime(nextOccurrence);
    const absoluteTime = formatDateTime(nextOccurrence);
    
    // If it's a relative time like "in 2 hours", combine it with absolute time
    if (relativeTime.startsWith('in ') || relativeTime === 'just now') {
      return `${absoluteTime} (${relativeTime})`;
    }
    
    return absoluteTime;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-600">Loading events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="text-center text-red-500">
          <p className="text-xs">⚠️ {error}</p>
        </div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="text-center text-gray-500">
          <p className="text-xs">📅 No upcoming events</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
        {events.map((event) => (
          <div 
            key={event.id} 
            className="p-3 hover:bg-gray-50 transition-colors"
          >
            {/* Event Title */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold text-gray-900 flex-1">
                {event.title}
              </h3>
              <span 
                className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded border ${getStatusBadgeColor(event.status)}`}
              >
                {getStatusLabel(event.status)}
              </span>
            </div>

            {/* Event Description */}
            {event.description && (
              <p className="text-xs text-gray-600 mb-2">
                {event.description}
              </p>
            )}

            {/* Next Occurrence */}
            <div className="flex items-center gap-1 text-xs text-gray-700 mb-1">
              <span className="font-medium">Next occurrence:</span>
              <span>{formatNextOccurrence(event.next_occurrence)}</span>
            </div>

            {/* Recurrence Info */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-xs">
                <span>{getRecurrenceIcon(event.recurrence_type)}</span>
                <span className="text-gray-700 font-medium">
                  {getRecurrenceLabel(event.recurrence_type)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventsPanel;
