'use client';

import { useState } from 'react';
import {
  CircleCheck,
  Mail,
  Clock,
  Building,
  ShieldCheck,
  Send,
  Loader2,
  Sparkles,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';

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

  const supportPillars = [
    {
      icon: Clock,
      title: '24-Hour Response SLA',
      desc: 'Our dedicated UK resolution team responds to all inquiries within 24 business hours.',
    },
    {
      icon: ShieldCheck,
      title: 'Escrow & Dispute Arbitration',
      desc: 'Expert case managers ready to assist with delivery or verification disputes.',
    },
    {
      icon: Mail,
      title: 'Direct Email Support',
      desc: 'Reach us directly anytime at support@veribuy.shop for priority handling.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="contact-hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #1C2D16 0%, #2D4720 30%, #4A6B35 70%, #2A3B22 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: 'radial-gradient(circle at 50% 30%, #10B981 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 text-xs font-bold tracking-wide uppercase text-emerald-300 shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Dedicated Customer Support</span>
          </div>
          <h1
            id="contact-hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight mb-4 text-white"
          >
            We&apos;re Here to Help
          </h1>
          <p className="text-base sm:text-lg text-emerald-100/90 max-w-xl mx-auto leading-relaxed">
            Have questions about a listing, Trust Lens™ check, escrow payment, or dispute? Send our team a message below.
          </p>
        </div>
      </section>

      {/* Support Pillars Strip */}
      <section className="max-w-5xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {supportPillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="bg-white rounded-2xl p-5 border border-[var(--color-border)] shadow-md flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-green)] flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 mb-0.5">{pillar.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{pillar.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="max-w-5xl mx-auto px-4 py-14 md:py-16">
        <div className="grid md:grid-cols-12 gap-8 md:gap-12 items-start">
          {/* Form (7 cols) */}
          <div className="md:col-span-7 bg-white rounded-3xl p-8 border border-[var(--color-border)] shadow-md">
            <h2 className="text-2xl font-black text-gray-900 mb-2">Send Us a Message</h2>
            <p className="text-xs text-gray-500 mb-6">Fill out the form below and an agent will be assigned to your ticket.</p>

            {submitted ? (
              <div
                role="status"
                aria-live="polite"
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-green)] text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <CircleCheck className="w-8 h-8" aria-hidden="true" />
                </div>
                <h3 className="font-black text-xl text-gray-900 mb-1">Message Received!</h3>
                <p className="text-sm text-gray-600 mb-6 max-w-sm mx-auto leading-relaxed">
                  Thanks for reaching out, {name || 'there'}. We have logged your request and will respond within 24 hours.
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
                  className="px-6 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors shadow-xs"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit} noValidate>
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm text-gray-900 bg-white placeholder-gray-400"
                    placeholder="e.g. Jane Doe"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Email Address
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm text-gray-900 bg-white placeholder-gray-400"
                    placeholder="jane.doe@example.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Subject / Order Reference
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm text-gray-900 bg-white placeholder-gray-400"
                    placeholder="e.g. Question about order #VB-9821"
                  />
                </div>
                <div>
                  <label htmlFor="contact-message" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                    Message Details
                  </label>
                  <textarea
                    id="contact-message"
                    rows={5}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm text-gray-900 bg-white placeholder-gray-400 leading-relaxed"
                    placeholder="Describe how we can assist you..."
                  />
                </div>

                {error && (
                  <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white py-3.5 rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending message...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Message to Support</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Info Sidebar (5 cols) */}
          <div className="md:col-span-5 space-y-5">
            <div className="bg-white rounded-3xl p-6 border border-[var(--color-border)] shadow-xs">
              <h3 className="text-base font-black text-gray-900 mb-2 flex items-center gap-2">
                <Mail className="w-4 h-4 text-[var(--color-green)]" />
                <span>Direct Support Email</span>
              </h3>
              <p className="text-xs text-gray-500 mb-3">For general inquiries, order status, and seller questions:</p>
              <a
                href="mailto:support@veribuy.shop"
                className="inline-block px-4 py-2 rounded-xl bg-[var(--color-surface-alt)] font-mono text-sm font-bold text-[var(--color-green)] hover:underline border border-gray-100"
              >
                support@veribuy.shop
              </a>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-[var(--color-border)] shadow-xs">
              <h3 className="text-base font-black text-gray-900 mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--color-green)]" />
                <span>Operating Hours</span>
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                <strong>Monday &ndash; Friday:</strong> 9:00 AM &ndash; 6:00 PM GMT<br />
                <strong>Saturday &ndash; Sunday:</strong> Urgent escrow escalations only
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-[var(--color-border)] shadow-xs">
              <h3 className="text-base font-black text-gray-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--color-green)]" />
                <span>Security &amp; Disputes</span>
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Need to escalate a device condition mismatch? Open an order dispute directly from your <a href="/orders" className="text-[var(--color-green)] font-bold hover:underline">Orders Dashboard</a> to preserve your 7-day inspection return window.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
