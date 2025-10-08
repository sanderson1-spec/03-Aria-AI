import React, { useState, useEffect } from 'react';

interface Commitment {
  id: string;
  description: string;
  due_at?: string;
  status: 'active' | 'submitted' | 'verified' | 'completed' | 'cancelled' | 'needs_revision' | 'rejected' | 'not_verifiable' | 'pending_verification';
  commitment_type?: string;
  character_notes?: string;
  submission_content?: string;
  verification_result?: string;
  verification_reasoning?: string;
  verification_decision?: 'approved' | 'needs_revision' | 'rejected' | 'not_verifiable';
  revision_count?: number;
  assigned_at?: string;
  submitted_at?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

interface VerificationResult {
  decision: 'approved' | 'needs_revision' | 'rejected' | 'not_verifiable' | 'pending';
  feedback: string;
  canResubmit: boolean;
  isVerifiable?: boolean;
  timingAssessment?: string;
  qualityAssessment?: string;
}

interface VerificationResponse {
  success: boolean;
  message: string;
  verification: VerificationResult;
  data: Commitment;
  character?: {
    id: string;
    name: string;
    currentMood?: string;
  };
  revisionCount?: number;
}

interface CommitmentPanelProps {
  chatId: string;
  userId: string;
  onVerificationFeedback?: (verificationData: {
    feedback: string;
    decision: 'approved' | 'needs_revision' | 'rejected' | 'not_verifiable' | 'pending';
    canResubmit: boolean;
    commitmentId: string;
    commitmentDescription: string;
    characterName: string;
  }) => void;
}

const CommitmentPanel: React.FC<CommitmentPanelProps> = ({ chatId, userId, onVerificationFeedback }) => {
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommitment, setSelectedCommitment] = useState<Commitment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

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
    setVerificationResult(null);
    
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
      
      const data: VerificationResponse = await response.json();
      
      if (data.success && data.verification) {
        // Show verification result
        setVerificationResult(data);
        setShowVerification(true);
        
        // Send verification feedback to chat
        if (onVerificationFeedback && data.character) {
          onVerificationFeedback({
            feedback: data.verification.feedback,
            decision: data.verification.decision,
            canResubmit: data.verification.canResubmit,
            commitmentId: selectedCommitment.id,
            commitmentDescription: selectedCommitment.description,
            characterName: data.character.name
          });
        }
        
        // Update commitments list
        await loadCommitments();
        
        // Auto-close modal if approved or not verifiable
        if (data.verification.decision === 'approved' || data.verification.decision === 'not_verifiable') {
          setTimeout(() => {
            setShowVerification(false);
            setSelectedCommitment(null);
            setSubmissionText('');
            setVerificationResult(null);
          }, 3000);
        }
      } else {
        throw new Error(data.message || 'Failed to submit commitment');
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to submit commitment' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResubmit = async () => {
    if (!selectedCommitment || !submissionText.trim()) {
      setMessage({ type: 'error', text: 'Submission text is required' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setVerificationResult(null);
    
    try {
      const response = await fetch(
        `http://localhost:3001/api/commitments/${selectedCommitment.id}/resubmit`,
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
      
      const data: VerificationResponse = await response.json();
      
      if (data.success && data.verification) {
        // Show verification result
        setVerificationResult(data);
        setShowVerification(true);
        setIsResubmitting(false);
        
        // Send verification feedback to chat
        if (onVerificationFeedback && data.character) {
          onVerificationFeedback({
            feedback: data.verification.feedback,
            decision: data.verification.decision,
            canResubmit: data.verification.canResubmit,
            commitmentId: selectedCommitment.id,
            commitmentDescription: selectedCommitment.description,
            characterName: data.character.name
          });
        }
        
        // Update commitments list
        await loadCommitments();
        
        // Auto-close modal if approved or not verifiable
        if (data.verification.decision === 'approved' || data.verification.decision === 'not_verifiable') {
          setTimeout(() => {
            setShowVerification(false);
            setSelectedCommitment(null);
            setSubmissionText('');
            setVerificationResult(null);
          }, 3000);
        }
      } else {
        throw new Error(data.message || 'Failed to resubmit commitment');
      }
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to resubmit commitment' 
      });
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTimeTaken = (startTime?: string, endTime?: string): string => {
    if (!startTime || !endTime) return 'Unknown';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days} day${days > 1 ? 's' : ''} ${remainingHours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
  };

  const getVerificationIcon = (decision: string) => {
    switch (decision) {
      case 'approved': return '✅';
      case 'needs_revision': return '⚠️';
      case 'rejected': return '❌';
      case 'not_verifiable': return '🤷';
      case 'pending': return '⏳';
      default: return '●';
    }
  };

  const getVerificationColor = (decision: string) => {
    switch (decision) {
      case 'approved': return { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800', icon: 'text-green-600' };
      case 'needs_revision': return { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-800', icon: 'text-yellow-600' };
      case 'rejected': return { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', icon: 'text-red-600' };
      case 'not_verifiable': return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', icon: 'text-gray-600' };
      case 'pending': return { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', icon: 'text-blue-600' };
      default: return { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800', icon: 'text-gray-600' };
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
                {commitment.status === 'pending_verification' && <span className="text-blue-500 text-sm">⏳</span>}
                {commitment.status === 'needs_revision' && <span className="text-yellow-600 text-sm">⚠️</span>}
                {commitment.status === 'completed' && <span className="text-green-500 text-sm">✓</span>}
                {commitment.status === 'rejected' && <span className="text-red-500 text-sm">✗</span>}
                {commitment.status === 'not_verifiable' && <span className="text-gray-500 text-sm">🤷</span>}
                {commitment.status === 'cancelled' && <span className="text-gray-400 text-sm">○</span>}
              </div>
              
              {/* Description */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate" title={commitment.description}>
                  {commitment.description}
                </p>
                {commitment.revision_count && commitment.revision_count > 0 && (
                  <p className="text-xs text-gray-500">
                    Attempt {commitment.revision_count + 1}
                  </p>
                )}
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
                    setSubmissionText('');
                    setIsResubmitting(false);
                    setShowVerification(false);
                    setMessage(null);
                  }}
                  className="flex-shrink-0 px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded transition-colors"
                  title="Submit this commitment"
                >
                  Submit
                </button>
              )}
              
              {/* Resubmit Button */}
              {commitment.status === 'needs_revision' && (
                <button
                  onClick={() => {
                    setSelectedCommitment(commitment);
                    setSubmissionText(commitment.submission_content || '');
                    setIsResubmitting(true);
                    setShowVerification(false);
                    setMessage(null);
                  }}
                  className="flex-shrink-0 px-3 py-1 bg-yellow-500 hover:bg-yellow-600 text-white text-xs font-medium rounded transition-colors"
                  title="Revise and resubmit"
                >
                  Revise
                </button>
              )}
              
              {/* Submitted Status */}
              {(commitment.status === 'submitted' || commitment.status === 'pending_verification') && (
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
              
              {/* Rejected Status */}
              {commitment.status === 'rejected' && (
                <span className="flex-shrink-0 text-xs text-red-700 font-medium">
                  Rejected
                </span>
              )}
              
              {/* Not Verifiable Status */}
              {commitment.status === 'not_verifiable' && (
                <span className="flex-shrink-0 text-xs text-gray-700 font-medium">
                  Honor System
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Submit/Resubmit Modal */}
      {selectedCommitment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-gray-800">
                {isResubmitting ? 'Revise Commitment' : 'Submit Commitment'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {selectedCommitment.description}
              </p>
              {isResubmitting && selectedCommitment.revision_count !== undefined && (
                <p className="text-xs text-yellow-700 mt-2 font-medium">
                  📝 Attempt {selectedCommitment.revision_count + 2} of unlimited
                </p>
              )}
            </div>

            {/* Previous Feedback (if resubmitting) */}
            {isResubmitting && selectedCommitment.verification_result && (
              <div className="p-6 bg-yellow-50 border-b border-yellow-100">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💬</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-900 mb-1">
                      Previous Feedback:
                    </p>
                    <p className="text-sm text-yellow-800 whitespace-pre-wrap">
                      {selectedCommitment.verification_result}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Verification Result Display */}
            {showVerification && verificationResult && (
              <div className={`p-6 border-b ${getVerificationColor(verificationResult.verification.decision).bg}`}>
                <div className="flex items-start gap-4">
                  <div className={`text-4xl ${getVerificationColor(verificationResult.verification.decision).icon}`}>
                    {getVerificationIcon(verificationResult.verification.decision)}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-bold ${getVerificationColor(verificationResult.verification.decision).text} mb-2`}>
                      {verificationResult.verification.decision === 'approved' && 'Approved! ✨'}
                      {verificationResult.verification.decision === 'needs_revision' && 'Needs Revision'}
                      {verificationResult.verification.decision === 'rejected' && 'Rejected'}
                      {verificationResult.verification.decision === 'not_verifiable' && 'Not Verifiable'}
                      {verificationResult.verification.decision === 'pending' && 'Verification Pending'}
                    </h3>
                    
                    {/* Character Feedback */}
                    <div className="bg-white rounded-lg p-4 mb-3 shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        {verificationResult.character && (
                          <p className="text-sm font-semibold text-gray-700">
                            {verificationResult.character.name}:
                          </p>
                        )}
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">
                        {verificationResult.verification.feedback}
                      </p>
                    </div>

                    {/* Verification Metadata */}
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {verificationResult.data.assigned_at && verificationResult.data.submitted_at && (
                        <div className="bg-white rounded p-2 shadow-sm">
                          <p className="text-gray-600 font-medium">Time Taken</p>
                          <p className="text-gray-800 font-semibold">
                            {calculateTimeTaken(verificationResult.data.assigned_at, verificationResult.data.submitted_at)}
                          </p>
                        </div>
                      )}
                      
                      {verificationResult.verification.timingAssessment && (
                        <div className="bg-white rounded p-2 shadow-sm">
                          <p className="text-gray-600 font-medium">Timing</p>
                          <p className="text-gray-800 font-semibold capitalize">
                            {verificationResult.verification.timingAssessment}
                          </p>
                        </div>
                      )}
                      
                      {verificationResult.verification.qualityAssessment && (
                        <div className="bg-white rounded p-2 shadow-sm">
                          <p className="text-gray-600 font-medium">Quality</p>
                          <p className="text-gray-800 font-semibold capitalize">
                            {verificationResult.verification.qualityAssessment}
                          </p>
                        </div>
                      )}

                      {verificationResult.revisionCount !== undefined && verificationResult.revisionCount > 0 && (
                        <div className="bg-white rounded p-2 shadow-sm">
                          <p className="text-gray-600 font-medium">Revisions</p>
                          <p className="text-gray-800 font-semibold">
                            {verificationResult.revisionCount}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Not Verifiable Explanation */}
                    {verificationResult.verification.decision === 'not_verifiable' && (
                      <div className="mt-3 bg-white rounded-lg p-3 shadow-sm">
                        <p className="text-xs text-gray-700">
                          <span className="font-semibold">Honor System:</span> This task has been marked as completed.
                          Your character trusts your word on tasks they cannot verify directly.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Submission Form (shown when not displaying verification or when needs revision) */}
            {(!showVerification || (verificationResult?.verification.canResubmit)) && (
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isResubmitting ? 'Revised Submission Details *' : 'Submission Details *'}
                </label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  rows={6}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={
                    isResubmitting 
                      ? "Revise your submission based on the feedback above..." 
                      : "Describe what you've done to fulfill this commitment..."
                  }
                  disabled={submitting}
                />
                <p className="text-xs text-gray-500 mt-2">
                  {isResubmitting 
                    ? 'Address the feedback and explain what you improved or clarified.'
                    : 'Provide details about how you completed this commitment. The character will review your submission.'}
                </p>
              </div>
            )}

            {/* Modal Actions */}
            <div className="p-6 border-t flex justify-end space-x-3">
              {/* Loading Spinner */}
              {submitting && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Verifying...</span>
                </div>
              )}

              {/* Close button (when verification complete and cannot resubmit) */}
              {showVerification && verificationResult && !verificationResult.verification.canResubmit && !submitting && (
                <button
                  onClick={() => {
                    setSelectedCommitment(null);
                    setSubmissionText('');
                    setVerificationResult(null);
                    setShowVerification(false);
                    setIsResubmitting(false);
                    setMessage(null);
                  }}
                  className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Close
                </button>
              )}

              {/* Cancel and Submit/Resubmit buttons */}
              {(!showVerification || (verificationResult?.verification.canResubmit)) && !submitting && (
                <>
                  <button
                    onClick={() => {
                      setSelectedCommitment(null);
                      setSubmissionText('');
                      setVerificationResult(null);
                      setShowVerification(false);
                      setIsResubmitting(false);
                      setMessage(null);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={isResubmitting || (showVerification && verificationResult?.verification.canResubmit) ? handleResubmit : handleSubmit}
                    disabled={!submissionText.trim()}
                    className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 ${
                      !submissionText.trim()
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : isResubmitting || (showVerification && verificationResult?.verification.canResubmit)
                        ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                  >
                    {isResubmitting || (showVerification && verificationResult?.verification.canResubmit) ? 'Resubmit' : 'Submit'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommitmentPanel;

