'use client';

import { useState } from 'react';

interface ContactSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  buyerId: string;
}

export default function ContactSellerModal({
  isOpen,
  onClose,
  listingId,
  listingTitle,
  sellerId,
  buyerId,
}: ContactSellerModalProps) {
  const [subject, setSubject] = useState(`Inquiry about: ${listingTitle}`);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setSending(true);
    setError('');

    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          senderId: buyerId,
          recipientId: sellerId,
          listingId,
          subject,
          content: message,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send message');
      }

      setSuccess(true);
      
      // Close modal after 2 seconds
      setTimeout(() => {
        onClose();
        // Reset form
        setMessage('');
        setSubject(`Inquiry about: ${listingTitle}`);
        setSuccess(false);
      }, 2000);

    } catch (err: any) {
      console.error('Error sending message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold text-[var(--color-text)]">Contact Seller</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            disabled={sending}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-semibold text-green-600 mb-2">Message Sent!</h3>
              <p className="text-gray-600">The seller will be notified and can respond to your inquiry.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Listing Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Regarding:</p>
                <p className="font-medium text-[var(--color-text)]">{listingTitle}</p>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="What would you like to ask?"
                  disabled={sending}
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Ask about condition, shipping, price, etc..."
                  disabled={sending}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Be respectful and provide specific questions
                </p>
              </div>

              {/* Error Display */}
              {error && (
                <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  disabled={sending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className={`flex-1 px-6 py-3 rounded-md font-semibold text-white ${
                    sending || !message.trim()
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-[var(--color-primary)] hover:opacity-90'
                  }`}
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
