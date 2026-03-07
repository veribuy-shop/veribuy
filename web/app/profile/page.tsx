'use client';

import { ProtectedRoute } from '@/components/protected-route';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Profile {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string | null;
}

function ProfileContent() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>({});
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.id) fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/users/${user.id}/profile`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data: Profile = await res.json();
        setProfile(data);
        setDisplayName(data.displayName ?? '');
        setFirstName(data.firstName ?? '');
        setLastName(data.lastName ?? '');
        setPhone(data.phone ?? '');
        setBio(data.bio ?? '');
      } else if (res.status === 404) {
        // No profile yet — seed from auth name
        const name = user.name ?? '';
        const parts = name.split(' ');
        setFirstName(parts[0] ?? '');
        setLastName(parts.slice(1).join(' '));
        setDisplayName(name);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user?.id}/profile`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: displayName.trim() || `${firstName} ${lastName}`.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save changes');
      }
      setSuccess('Profile updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 flex justify-center">
        <div role="status" className="text-center">
          <div
            aria-hidden="true"
            className="inline-block motion-safe:animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-primary)]"
          />
          <span className="sr-only">Loading profile...</span>
          <p aria-hidden="true" className="mt-3 text-sm text-gray-500">
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  const initials = (displayName || user?.name || 'U').charAt(0).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">My Profile</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Manage how you appear on VeriBuy.
        </p>
      </div>

      {/* Account Details */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-[var(--color-border)] mb-6">
        <h2 className="font-bold text-lg mb-6">Account Details</h2>

        {success && (
          <div
            role="status"
            aria-live="polite"
            className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm"
          >
            {success}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div
              aria-hidden="true"
              className="w-16 h-16 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0"
            >
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium">{displayName || user?.name}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{user?.email}</p>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label htmlFor="profile-display-name" className="block text-sm font-medium mb-1">
              Display Name
            </label>
            <input
              id="profile-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How you want to appear to buyers and sellers"
              maxLength={80}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* First / Last */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="profile-first-name" className="block text-sm font-medium mb-1">
                First Name
              </label>
              <input
                id="profile-first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                maxLength={50}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
            <div>
              <label htmlFor="profile-last-name" className="block text-sm font-medium mb-1">
                Last Name
              </label>
              <input
                id="profile-last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                maxLength={50}
                className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Email (read-only) */}
          <div>
            <label htmlFor="profile-email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={user?.email ?? ''}
              disabled
              aria-describedby="profile-email-hint"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
            <p id="profile-email-hint" className="text-xs text-[var(--color-text-muted)] mt-1">
              Email cannot be changed
            </p>
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="profile-phone" className="block text-sm font-medium mb-1">
              Phone Number{' '}
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <input
              id="profile-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+44 7700 900000"
              autoComplete="tel"
              maxLength={30}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="profile-bio" className="block text-sm font-medium mb-1">
              Bio{' '}
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Tell buyers or sellers a bit about yourself..."
              aria-describedby="profile-bio-count"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
            <p id="profile-bio-count" className="text-xs text-gray-400 mt-1">
              {bio.length}/500 characters
            </p>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={fetchProfile}
              className="px-6 py-2.5 border border-[var(--color-border)] rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
          </div>
        </form>
      </div>

      {/* Verification Status */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-[var(--color-border)] mb-6">
        <h2 className="font-bold text-lg mb-4">Verification Status</h2>
        <div className="flex items-center gap-3">
          <span className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full font-medium">
            Unverified
          </span>
          <p className="text-sm text-[var(--color-text-muted)]">
            Complete identity verification to start selling.
          </p>
        </div>
        <Link
          href="/seller-verification"
          className="inline-block mt-4 text-sm text-[var(--color-primary)] font-medium hover:underline"
        >
          Learn about verification &rarr;
        </Link>
      </div>

      {/* Account Settings link */}
      <p className="text-sm text-[var(--color-text-muted)]">
        Need to change your password or notification preferences?{' '}
        <Link href="/settings" className="text-[var(--color-primary)] font-medium hover:underline">
          Go to Account Settings
        </Link>
      </p>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfileContent />
    </ProtectedRoute>
  );
}
