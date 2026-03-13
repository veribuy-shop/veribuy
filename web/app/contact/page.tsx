'use client';

import { useState } from 'react';
import { CircleCheck } from 'lucide-react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromName: name,
          fromEmail: email,
          subject,
          message,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to send message. Please try again.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="contact-hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #5C7A3E 0%, #4A6B35 30%, #8B7355 70%, #6B5A3E 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, #F5C842 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <h1
            id="contact-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            Contact Us
          </h1>
          <p className="text-base md:text-lg text-white/80">
            We&apos;re here to help with any questions
          </p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="max-w-5xl mx-auto px-4 py-14 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          {/* Contact Form */}
          <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-6">Send us a message</h2>

            {submitted ? (
              <div
                role="status"
                aria-live="polite"
                className="bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 rounded-xl p-6 text-center"
              >
                <CircleCheck className="w-10 h-10 text-[var(--color-success)] mx-auto mb-3" aria-hidden="true" />
                <p className="font-semibold text-lg text-[var(--color-text)] mb-1">Message received!</p>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Thanks for reaching out, {name || 'there'}. We&apos;ll get back to you within 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setName('');
                    setEmail('');
                    setSubject('');
                    setMessage('');
                    setSubmitted(false);
                  }}
                  className="mt-4 text-sm text-[var(--color-green)] hover:text-[var(--color-green-dark)] underline hover:no-underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <label htmlFor="contact-name" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-[var(--color-text)]"
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-[var(--color-text)]"
                    placeholder="your@email.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-[var(--color-text)]"
                    placeholder="How can we help?"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-2.5 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-[var(--color-text)]"
                    placeholder="Your message..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--color-primary)] hover:opacity-90 text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending...' : 'Send Message'}
                </button>
                {error && (
                  <p role="alert" aria-live="assertive" className="text-sm text-[var(--color-danger)] text-center">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">Email</h3>
              <p className="text-[var(--color-text-muted)] mb-2">General inquiries &amp; support:</p>
              <a href="mailto:veribuy.shop@gmail.com" className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium">
                veribuy.shop@gmail.com
              </a>
            </div>

            <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">Response Time</h3>
              <p className="text-[var(--color-text-muted)]">
                We typically respond within 24 hours during business days (Monday&ndash;Friday).
              </p>
            </div>

            <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">Office Hours</h3>
              <p className="text-[var(--color-text-muted)]">
                Monday &ndash; Friday: 9:00 AM &ndash; 6:00 PM<br />
                Saturday &ndash; Sunday: Closed
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
