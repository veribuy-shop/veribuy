'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Inbox, Send, Mail } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { MESSAGES_READ_EVENT } from '@/lib/unread-messages';

interface InboxMessage {
  id: string;
  senderId: string;
  recipientId: string;
  senderName: string;
  recipientName: string;
  listingId: string | null;
  listingTitle: string | null;
  subject: string | null;
  content: string;
  isSystem: boolean;
  isRead: boolean;
  createdAt: string;
}

interface Thread {
  key: string;
  isSystem: boolean;
  otherUserId: string;
  otherName: string;
  listingId: string | null;
  listingTitle: string | null;
  subject: string | null;
  messages: InboxMessage[]; // oldest first
  unread: number;
  lastAt: string;
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function groupThreads(messages: InboxMessage[], userId: string): Thread[] {
  const threads = new Map<string, Thread>();
  // Oldest first so each thread's messages read top to bottom.
  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const m of sorted) {
    const incoming = m.recipientId === userId;
    const otherUserId = incoming ? m.senderId : m.recipientId;
    // Automated order/offer updates are collected in one VeriBuy thread.
    const key = m.isSystem ? 'system' : `${otherUserId}:${m.listingId ?? ''}`;
    let thread = threads.get(key);
    if (!thread) {
      thread = {
        key,
        isSystem: m.isSystem,
        otherUserId,
        otherName: m.isSystem ? 'VeriBuy updates' : incoming ? m.senderName : m.recipientName,
        listingId: m.isSystem ? null : m.listingId,
        listingTitle: m.isSystem ? 'Orders, offers and listings' : m.listingTitle,
        subject: m.isSystem ? null : m.subject,
        messages: [],
        unread: 0,
        lastAt: m.createdAt,
      };
      threads.set(key, thread);
    }
    thread.messages.push(m);
    thread.lastAt = m.createdAt;
    if (incoming && !m.isRead) thread.unread += 1;
  }
  return [...threads.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export default function MessagesPage() {
  const router = useRouter();
  const { user, loading: authLoading, authFetch } = useAuth();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await authFetch('/api/messages');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load messages');
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/messages');
      return;
    }
    load();
  }, [authLoading, user, load, router]);

  const threads = useMemo(() => (user ? groupThreads(messages, user.id) : []), [messages, user]);
  const active = threads.find((t) => t.key === activeKey) ?? null;

  // Mark the open thread's unread messages as read.
  useEffect(() => {
    if (!active || !user) return;
    const unread = active.messages.filter((m) => m.recipientId === user.id && !m.isRead);
    if (unread.length === 0) return;
    Promise.all(
      unread.map((m) => authFetch(`/api/messages/${m.id}/read`, { method: 'PATCH' }).catch(() => null)),
    ).then(() => {
      const ids = new Set(unread.map((m) => m.id));
      setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, isRead: true } : m)));
      window.dispatchEvent(new Event(MESSAGES_READ_EVENT));
    });
  }, [active, user, authFetch]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !reply.trim()) return;
    setSending(true);
    setSendError('');
    try {
      const baseSubject = active.subject || active.listingTitle || 'your message';
      const res = await authFetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientId: active.otherUserId,
          listingId: active.listingId ?? undefined,
          subject: baseSubject.startsWith('Re: ') ? baseSubject : `Re: ${baseSubject}`,
          content: reply.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to send message');
      setReply('');
      await load();
    } catch (err: any) {
      setSendError(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const totalUnread = threads.reduce((sum, t) => sum + t.unread, 0);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-8">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-1">
          <Inbox className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Messages</h1>
          {totalUnread > 0 && (
            <span className="ml-1 text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--color-accent)] text-white">
              {totalUnread} unread
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Messages from buyers and sellers, plus updates about your orders, offers and listings.
        </p>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]" role="status">Loading messages…</p>
        ) : threads.length === 0 ? (
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-8 text-center">
            <Mail className="w-8 h-8 mx-auto text-[var(--color-text-muted)] mb-2" aria-hidden="true" />
            <p className="text-sm text-[var(--color-text-muted)]">
              No messages yet. When you contact a seller, make an offer or place an order, the conversation appears here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-[var(--color-border)] rounded-xl overflow-hidden md:grid md:grid-cols-[minmax(0,320px)_1fr] md:min-h-[520px]">
            {/* Thread list */}
            <ul
              aria-label="Conversations"
              className={`divide-y divide-[var(--color-border)] md:border-r md:border-[var(--color-border)] md:max-h-[640px] md:overflow-y-auto ${
                active ? 'hidden md:block' : ''
              }`}
            >
              {threads.map((t) => {
                const last = t.messages[t.messages.length - 1];
                const selected = t.key === activeKey;
                return (
                  <li key={t.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveKey(t.key);
                        setSendError('');
                      }}
                      aria-current={selected ? 'true' : undefined}
                      className={`w-full text-left px-4 py-3 hover:bg-[var(--color-surface-alt)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-green)] ${
                        selected ? 'bg-[var(--color-surface-alt)]' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-sm truncate ${t.unread > 0 ? 'font-bold text-[var(--color-text)]' : 'font-medium text-[var(--color-text)]'}`}>
                          {t.otherName}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)] shrink-0">{formatWhen(t.lastAt)}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {t.listingTitle ?? t.subject ?? 'General'}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p className={`text-xs truncate ${t.unread > 0 ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                          {last.senderId === user?.id ? 'You: ' : ''}
                          {last.content}
                        </p>
                        {t.unread > 0 && (
                          <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[var(--color-accent)] text-white text-[11px] font-bold flex items-center justify-center">
                            <span className="sr-only">Unread messages: </span>
                            {t.unread}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Conversation */}
            <section
              aria-label={active ? `Conversation with ${active.otherName}` : 'Conversation'}
              className={`flex flex-col ${active ? '' : 'hidden md:flex'}`}
            >
              {!active ? (
                <div className="flex-1 flex items-center justify-center p-8 text-sm text-[var(--color-text-muted)]">
                  Select a conversation to read it.
                </div>
              ) : (
                <>
                  <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
                    <button
                      type="button"
                      onClick={() => setActiveKey(null)}
                      className="md:hidden p-2 -ml-2 rounded-lg hover:bg-[var(--color-surface-alt)]"
                      aria-label="Back to conversations"
                    >
                      <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-[var(--color-text)] truncate">{active.otherName}</h2>
                      {active.listingId && active.listingTitle ? (
                        <Link href={`/listings/${active.listingId}`} className="text-xs text-[var(--color-green)] hover:underline truncate block">
                          {active.listingTitle}
                        </Link>
                      ) : active.subject ? (
                        <p className="text-xs text-[var(--color-text-muted)] truncate">{active.subject}</p>
                      ) : null}
                    </div>
                  </header>

                  <ol className="flex-1 overflow-y-auto p-4 space-y-3 md:max-h-[460px]" aria-live="polite">
                    {active.messages.map((m) => {
                      const mine = m.senderId === user?.id;
                      return (
                        <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                              mine
                                ? 'bg-[var(--color-green)] text-white rounded-br-sm'
                                : 'bg-[var(--color-surface-alt)] text-[var(--color-text)] rounded-bl-sm'
                            }`}
                          >
                            {m.isSystem && m.listingTitle && (
                              <p className="text-[11px] text-[var(--color-text-muted)] mb-0.5">{m.listingTitle}</p>
                            )}
                            {m.subject && !m.subject.startsWith('Re: ') && (
                              <p className={`text-xs font-bold mb-1 ${mine ? 'text-white/90' : 'text-[var(--color-text)]'}`}>{m.subject}</p>
                            )}
                            <p className="whitespace-pre-wrap break-words">{m.content}</p>
                            <p className={`text-[11px] mt-1 ${mine ? 'text-white/80' : 'text-[var(--color-text-muted)]'}`}>
                              <span className="sr-only">{mine ? 'You' : active.otherName}, </span>
                              {new Date(m.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>

                  {active.isSystem ? (
                    <p className="border-t border-[var(--color-border)] p-3 text-xs text-[var(--color-text-muted)]">
                      These are automated updates. To act on an order, open it from{' '}
                      <Link href="/orders" className="text-[var(--color-green)] font-semibold hover:underline">My orders</Link>
                      {' '}or{' '}
                      <Link href="/offers" className="text-[var(--color-green)] font-semibold hover:underline">Offers</Link>.
                    </p>
                  ) : (
                  <form onSubmit={sendReply} className="border-t border-[var(--color-border)] p-3">
                    {sendError && (
                      <p role="alert" className="text-xs text-[var(--color-danger)] mb-2">{sendError}</p>
                    )}
                    <label htmlFor="reply" className="sr-only">Reply to {active.otherName}</label>
                    <div className="flex items-end gap-2">
                      <textarea
                        id="reply"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        rows={2}
                        maxLength={2000}
                        placeholder={`Reply to ${active.otherName}…`}
                        className="flex-1 resize-none px-3 py-2 border border-[var(--color-border)] rounded-lg text-sm focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent"
                      />
                      <button
                        type="submit"
                        disabled={sending || !reply.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                      >
                        <Send className="w-4 h-4" aria-hidden="true" />
                        {sending ? 'Sending…' : 'Send'}
                      </button>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1.5">
                      Keep payments on VeriBuy — never share bank details in messages.
                    </p>
                  </form>
                  )}
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
