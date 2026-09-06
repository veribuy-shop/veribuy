'use client';

import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, X, Tag, ShieldCheck, ArrowRight } from 'lucide-react';
import { formatPrice } from '@/lib/currency';

interface MakeOfferModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  askingPrice: number;
  currency?: string;
  sellerId: string;
  buyerId?: string;
}

export default function MakeOfferModal({
  isOpen,
  onClose,
  listingId,
  listingTitle,
  askingPrice,
  currency = 'GBP',
  sellerId,
}: MakeOfferModalProps) {
  const [offerPrice, setOfferPrice] = useState<string>('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Default suggested offer (e.g. ~90% of asking price rounded down)
      const defaultOffer = Math.max(1, Math.round(askingPrice * 0.9));
      setOfferPrice(String(defaultOffer));
      setNote('');
      setError('');
      setSuccess(false);

      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'input, button, [href], select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen, askingPrice]);

  // Accessibility: Trap focus & handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableEls = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        const first = focusableEls[0];
        const last = focusableEls[focusableEls.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const numericOffer = parseFloat(offerPrice) || 0;
  const discountPercent =
    askingPrice > 0 && numericOffer < askingPrice
      ? Math.round(((askingPrice - numericOffer) / askingPrice) * 100)
      : 0;

  const handleQuickPercent = (pct: number) => {
    const discounted = Math.max(1, Math.round(askingPrice * (1 - pct / 100)));
    setOfferPrice(String(discounted));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numericOffer || numericOffer <= 0) {
      setError('Please enter a valid offer amount');
      return;
    }

    if (numericOffer >= askingPrice) {
      setError(`Your offer is equal to or higher than the asking price (${formatPrice(askingPrice, currency)}). You can buy directly with Escrow Protection!`);
      return;
    }

    if (numericOffer < askingPrice * 0.4) {
      setError('Offer cannot be less than 40% of the asking price.');
      return;
    }

    setSending(true);
    setError('');

    try {
      const subject = `🏷️ Offer: ${formatPrice(numericOffer, currency)} for ${listingTitle}`;
      const messageBody = [
        `Hi! I would like to make an offer of ${formatPrice(numericOffer, currency)} on your listing "${listingTitle}" (Asking price: ${formatPrice(askingPrice, currency)}${discountPercent > 0 ? `, ${discountPercent}% discount` : ''}).`,
        note.trim() ? `\nBuyer note: "${note.trim()}"` : '',
        `\nI am ready to complete payment via VeriBuy Escrow once you accept.`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientId: sellerId,
          listingId,
          subject,
          content: messageBody,
          listingTitle,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to submit offer');
      }

      setSuccess(true);

      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2500);
    } catch (err: any) {
      console.error('Error submitting offer:', err);
      setError(err.message || 'Failed to submit offer. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="make-offer-title"
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-gray-100 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gradient-to-r from-emerald-50/50 via-white to-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[var(--color-green)] flex items-center justify-center shrink-0">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 id="make-offer-title" className="text-xl font-bold text-gray-900">
                Make an Offer
              </h2>
              <p className="text-xs text-gray-500 truncate max-w-[280px]">
                {listingTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">
                Offer Sent to Seller!
              </h3>
              <p className="text-sm text-gray-600 max-w-sm mx-auto mb-4">
                Your offer of <strong className="text-emerald-700 font-bold">{formatPrice(numericOffer, currency)}</strong> has been delivered to the seller's inbox. You will receive an alert as soon as they respond.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 text-xs text-gray-600">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Protected by VeriBuy Escrow when accepted</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                  {error}
                </div>
              )}

              {/* Price comparison card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                    Asking Price
                  </span>
                  <span className="text-xl font-black text-gray-900">
                    {formatPrice(askingPrice, currency)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">
                    Your Offer
                  </span>
                  <span className="text-xl font-black text-emerald-600">
                    {numericOffer > 0 ? formatPrice(numericOffer, currency) : '—'}
                  </span>
                  {discountPercent > 0 && (
                    <span className="block text-[11px] font-bold text-emerald-700">
                      ({discountPercent}% off)
                    </span>
                  )}
                </div>
              </div>

              {/* Quick offer buttons */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Quick Discount Options
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => handleQuickPercent(pct)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        discountPercent === pct
                          ? 'border-[var(--color-green)] bg-emerald-50 text-[var(--color-green)] shadow-xs'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      -{pct}% ({formatPrice(Math.round(askingPrice * (1 - pct / 100)), currency)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom amount */}
              <div>
                <label htmlFor="offerPriceInput" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Offer Amount (£ GBP)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-gray-400">
                    £
                  </span>
                  <input
                    id="offerPriceInput"
                    type="number"
                    step="1"
                    min="1"
                    max={askingPrice - 1}
                    value={offerPrice}
                    onChange={(e) => setOfferPrice(e.target.value)}
                    placeholder="e.g. 450"
                    required
                    className="w-full pl-8 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-base font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]/30 focus:border-[var(--color-green)]"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label htmlFor="offerNoteInput" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Add Note to Seller <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  id="offerNoteInput"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., I can complete payment immediately if accepted!"
                  rows={2}
                  maxLength={300}
                  className="w-full p-3 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-green)]/30 focus:border-[var(--color-green)] resize-none"
                />
              </div>

              {/* Escrow Guarantee note */}
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Zero-Risk Negotiation:</strong> Offers are non-binding. If the seller accepts, you pay through VeriBuy's 48-hour Escrow Protection.
                </p>
              </div>

              {/* CTA */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={sending}
                  className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sending || numericOffer <= 0}
                  className="flex-1 py-3 px-4 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  {sending ? (
                    'Submitting...'
                  ) : (
                    <>
                      <span>Send Offer</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
