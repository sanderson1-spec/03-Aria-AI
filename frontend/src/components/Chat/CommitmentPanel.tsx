import React, { useState, useEffect } from 'react';

interface Commitment {
  id: string;
  description: string;
  due_at?: string;
  status: 'active' | 'submitted' | 'verified' | 'completed' | 'cancelled';
  commitment_type?: string;
  character_notes?: string;
  submission_content?: string;
  verification_result?: string;
  verification_reasoning?: string;
  created_at: string;
  updated_at: string;
}

interface CommitmentPanelProps {
  chatId: string;
  userId: string;
}

const CommitmentPanel: React.FC<CommitmentPanelProps> = ({ chatId, userId }) => {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommitment, setSelectedCommitment] = useState<Commitment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadCommitments();
  }, [chatId, userId]);

  const loadCommitments = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3001/api/commitments/active?chatId=${chatId}&userId=${userId}`
      );
      const data = await response.json();
      
      if (data.success) {
        setCommitments(data.data || []);
      } else {
        throw new Error(data.error || 'Failed to load commitments');
      }
    } catch (error) {
      console.error('Failed to load commitments:', error);
      setMessage({ type: 'error', text: 'Failed to load commitments' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCommitment || !submissionText.trim()) {
      setMessage({ type: 'error', text: 'Submission text is required' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    
    try {
      const response = await fetch(
        `http://localhost:3001/api/commitments/${selectedCommitment.id}/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            submissionText: submissionText.trim()
          })
        }
      );
      
      const data = await response.json();
      
      if (data.success) {
        setMessage({ type: 'success', text: 'Commitment submitted successfully!' });
        setSelectedCommitment(null);
        setSubmissionText('');
        await loadCommitments();
      } else {
        throw new Error(data.error || 'Failed to submit commitment');
      }
    } catch (error) {
      console.error('Failed to submit commitment:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to submit commitment' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getDueDateInfo = (dueDate?: string) => {
    if (!dueDate) return null;

    const due = new Date(dueDate);
    const now = new Date();
    const diffMs = due.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffMs < 0) {
      // Overdue
      const daysOverdue = Math.ceil(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      return {
        color: 'red',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-600',
        label: `⚠️ Overdue by ${daysOverdue} day${daysOverdue > 1 ? 's' : ''}`,
        date: due.toLocaleDateString()
      };
    } else if (diffHours < 24) {
      // Due soon (within 24 hours)
      const hoursLeft = Math.floor(diffHours);
      return {
        color: 'yellow',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        textColor: 'text-amber-800',
        iconColor: 'text-amber-600',
        label: `⏰ Due in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`,
        date: due.toLocaleDateString()
      };
    } else {
      // Future
      const daysLeft = Math.ceil(diffHours / 24);
      return {
        color: 'green',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        textColor: 'text-green-800',
        iconColor: 'text-green-600',
        label: `📅 Due in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`,
        date: due.toLocaleDateString()
      };
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (commitments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="text-center text-gray-500">
          <p className="text-xs">🎯 No active commitments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Message */}
      {message && (
        <div className={`p-2 rounded text-xs ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      {/* Commitments List - Compact One-Line View */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
        {commitments.map((commitment) => {
          const dueDateInfo = getDueDateInfo(commitment.due_at);
          
          return (
            <div 
              key={commitment.id} 
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              {/* Status Icon */}
              <div className="flex-shrink-0 w-5 text-center">
                {commitment.status === 'active' && <span className="text-blue-500 text-sm">●</span>}
                {commitment.status === 'submitted' && <span className="text-yellow-500 text-sm">◐</span>}
                {commitment.status === 'completed' && <span className="text-green-500 text-sm">✓</span>}
                {commitment.status === 'cancelled' && <span className="text-gray-400 text-sm">○</span>}
              </div>
              
              {/* Description */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate" title={commitment.description}>
                  {commitment.description}
                </p>
              </div>
              
              {/* Due Date Icon */}
              {dueDateInfo && (
                <div className={`flex-shrink-0 text-xs ${dueDateInfo.textColor}`} title={dueDateInfo.label}>
                  {dueDateInfo.color === 'red' && '⚠️'}
                  {dueDateInfo.color === 'yellow' && '⏰'}
                  {dueDateInfo.color === 'green' && '📅'}
                </div>
              )}
              
              {/* Submit Button (Small) */}
              {commitment.status === 'active' && (
                <button
                  onClick={() => {
                    setSelectedCommitment(commitment);
                    setMessage(null);
                  }}
                  className="flex-shrink-0 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
                  title="Submit this commitment"
                >
                  Submit
                </button>
              )}
              
              {/* Submitted Status */}
              {commitment.status === 'submitted' && (
                <span className="flex-shrink-0 text-xs text-yellow-700 font-medium">
                  Pending
                </span>
              )}
              
              {/* Completed Status */}
              {commitment.status === 'completed' && (
                <span className="flex-shrink-0 text-xs text-green-700 font-medium">
                  Done
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit Modal */}
      {selectedCommitment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                Submit Commitment
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCommitment.description}
              </p>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Submission Details *
              </label>
              <textarea
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                rows={6}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe what you've done to fulfill this commitment..."
              />
              <p className="text-xs text-gray-500 mt-2">
                Provide details about how you completed this commitment. The character will review your submission.
              </p>
            </div>

            <div className="p-6 border-t flex justify-end space-x-3">
              <button
                onClick={() => {
                  setSelectedCommitment(null);
                  setSubmissionText('');
                  setMessage(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !submissionText.trim()}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                  submitting || !submissionText.trim()
                    ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitmentPanel;

