'use client';

import { useAuth } from '@/lib/auth-context';
import { useState, useEffect } from 'react';

function SettingsContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications'>('profile');
  const [displayName, setDisplayName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email] = useState(user?.email || '');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Security tab state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Notifications tab state
  const [notifSuccess, setNotifSuccess] = useState('');
  const [notifListingUpdates, setNotifListingUpdates] = useState(true);
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifTrustLens, setNotifTrustLens] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifPriceAlerts, setNotifPriceAlerts] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async (allowCreate = true) => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/users/${user.id}/profile`, {
        credentials: 'include', // SEC-12: send auth cookie so the API route can forward the token
      });
      
      if (response.ok) {
        const profile = await response.json();
        setDisplayName(profile.displayName || '');
        setFirstName(profile.firstName || '');
        setLastName(profile.lastName || '');
        setPhone(profile.phone || '');
        setBio(profile.bio || '');
      } else if (response.status === 404) {
        // Profile doesn't exist yet — only create it if allowCreate=true.
        // DATA-01: passing allowCreate=false prevents infinite recursion
        // (createInitialProfile → fetchProfile → createInitialProfile → …).
        if (allowCreate) {
          await createInitialProfile();
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const createInitialProfile = async () => {
    if (!user?.id || !user?.name) return;

    try {
      const response = await fetch(`/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // SEC-13: send auth cookie so the API route can forward the token
        body: JSON.stringify({
          displayName: user.name,
          firstName: user.name.split(' ')[0],
          lastName: user.name.split(' ').slice(1).join(' '),
        }),
      });

      if (response.ok) {
        // DATA-01: Pass allowCreate=false to prevent infinite recursion:
        // createInitialProfile → fetchProfile(false) — no further create attempt.
        await fetchProfile(false);
      }
    } catch (err) {
      console.error('Failed to create initial profile:', err);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`/api/users/${user?.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // SEC: send auth cookie so the API route can forward the token
        body: JSON.stringify({
          displayName: displayName || `${firstName} ${lastName}`.trim(),
          firstName,
          lastName,
          phone,
          bio,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update profile');
      }

      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div role="status" className="text-center">
          <div aria-hidden="true" className="inline-block motion-safe:animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
          <span className="sr-only">Loading profile...</span>
          <p aria-hidden="true" className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav aria-label="Settings sections" className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-4">
            <div role="tablist" aria-orientation="vertical" className="flex flex-col">
              <button
                role="tab"
                id="tab-profile"
                aria-selected={activeTab === 'profile'}
                aria-controls="tabpanel-profile"
                onClick={() => setActiveTab('profile')}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium mb-2 transition ${
                  activeTab === 'profile'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-gray-100'
                }`}
              >
                Profile
              </button>
              <button
                role="tab"
                id="tab-security"
                aria-selected={activeTab === 'security'}
                aria-controls="tabpanel-security"
                onClick={() => setActiveTab('security')}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium mb-2 transition ${
                  activeTab === 'security'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-gray-100'
                }`}
              >
                Security
              </button>
              <button
                role="tab"
                id="tab-notifications"
                aria-selected={activeTab === 'notifications'}
                aria-controls="tabpanel-notifications"
                onClick={() => setActiveTab('notifications')}
                className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${
                  activeTab === 'notifications'
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-text)] hover:bg-gray-100'
                }`}
              >
                Notifications
              </button>
            </div>
          </nav>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div
              role="tabpanel"
              id="tabpanel-profile"
              aria-labelledby="tab-profile"
              className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Profile Information</h2>

            {success && (
              <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6">
                {success}
              </div>
            )}

            {error && (
              <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* Profile Picture */}
              <div>
                <span className="block text-sm font-medium mb-3">Profile Picture</span>
                <div className="flex items-center gap-4">
                   <div className="w-20 h-20 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-2xl font-bold" aria-hidden="true">
                     {(displayName || user?.name || 'U').charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <button
                       type="button"
                       className="px-4 py-2 border border-[var(--color-border)] rounded-lg text-sm font-medium hover:bg-gray-50"
                       aria-describedby="photo-upload-note"
                     >
                       Upload Photo
                     </button>
                     <p id="photo-upload-note" className="text-xs text-gray-500 mt-1">Photo upload coming soon</p>
                   </div>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label htmlFor="settings-display-name" className="block text-sm font-medium mb-2">Display Name</label>
                <input
                  id="settings-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How you want to be known"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label htmlFor="settings-first-name" className="block text-sm font-medium mb-2">First Name</label>
                  <input
                    id="settings-first-name"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label htmlFor="settings-last-name" className="block text-sm font-medium mb-2">Last Name</label>
                  <input
                    id="settings-last-name"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="settings-email" className="block text-sm font-medium mb-2">Email</label>
                <input
                  id="settings-email"
                  type="email"
                  value={email}
                  disabled
                  aria-describedby="settings-email-hint"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
                />
                <p id="settings-email-hint" className="text-xs text-[var(--color-text-muted)] mt-1">
                  Email cannot be changed
                </p>
              </div>

              {/* Phone */}
              <div>
                <label htmlFor="settings-phone" className="block text-sm font-medium mb-2">Phone Number</label>
                <input
                  id="settings-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  autoComplete="tel"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="settings-bio" className="block text-sm font-medium mb-2">Bio</label>
                <textarea
                  id="settings-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell us about yourself..."
                  maxLength={500}
                  aria-describedby="settings-bio-count"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                <p id="settings-bio-count" className="text-xs text-gray-500 mt-1">{bio.length}/500 characters</p>
              </div>

              {/* Role Badge */}
              <div>
                <span className="block text-sm font-medium mb-2">Account Type</span>
                <div className="inline-block px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-medium">
                  {user?.role}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => fetchProfile()}
                  className="px-6 py-3 border border-[var(--color-border)] rounded-lg font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div
              role="tabpanel"
              id="tabpanel-security"
              aria-labelledby="tab-security"
              className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Security Settings</h2>
              
              <div className="space-y-6">
                {/* Change Password */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Change Password</h3>

                  {securitySuccess && (
                    <div role="status" aria-live="polite" className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                      {securitySuccess}
                    </div>
                  )}
                  {securityError && (
                    <div role="alert" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
                      {securityError}
                    </div>
                  )}

                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setSecuritySuccess('');
                      setSecurityError('');
                      if (!currentPassword || !newPassword || !confirmNewPassword) {
                        setSecurityError('Please fill in all password fields.');
                        return;
                      }
                      if (newPassword.length < 8) {
                        setSecurityError('New password must be at least 8 characters.');
                        return;
                      }
                      if (newPassword !== confirmNewPassword) {
                        setSecurityError('New passwords do not match.');
                        return;
                      }
                      setPasswordLoading(true);
                      try {
                        const res = await fetch('/api/auth/change-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ currentPassword, newPassword }),
                        });
                        if (res.ok) {
                          setSecuritySuccess('Password updated successfully.');
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmNewPassword('');
                          setTimeout(() => setSecuritySuccess(''), 4000);
                        } else {
                          const data = await res.json().catch(() => ({}));
                          setSecurityError(data.error || data.message || 'Failed to update password. Please try again.');
                        }
                      } catch {
                        setSecurityError('An error occurred. Please try again.');
                      } finally {
                        setPasswordLoading(false);
                      }
                    }}
                  >
                    <div>
                      <label htmlFor="current-password" className="block text-sm font-medium mb-2">Current Password</label>
                      <input
                        id="current-password"
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                        autoComplete="current-password"
                        className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="new-password" className="block text-sm font-medium mb-2">New Password</label>
                      <input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        autoComplete="new-password"
                        className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="confirm-new-password" className="block text-sm font-medium mb-2">Confirm New Password</label>
                      <input
                        id="confirm-new-password"
                        type="password"
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="Confirm new password"
                        autoComplete="new-password"
                        className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={passwordLoading}
                      className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {passwordLoading ? 'Updating...' : 'Update Password'}
                    </button>
                  </form>
                </div>

                {/* Two-Factor Authentication */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Add an extra layer of security to your account by enabling two-factor authentication.
                  </p>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      disabled
                      aria-describedby="2fa-coming-soon"
                      className="px-6 py-3 border border-[var(--color-primary)] text-[var(--color-primary)] rounded-lg font-semibold opacity-50 cursor-not-allowed"
                    >
                      Enable 2FA
                    </button>
                    <p id="2fa-coming-soon" className="text-sm text-gray-500">Coming soon</p>
                  </div>
                </div>

                {/* Active Sessions */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Active Sessions</h3>
                  <div className="bg-gray-50 rounded-lg p-4 mb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Current Session</p>
                        <p className="text-sm text-gray-600">Last active: Just now</p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">Active</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">Session management coming soon</p>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div
              role="tabpanel"
              id="tabpanel-notifications"
              aria-labelledby="tab-notifications"
              className="bg-white rounded-xl shadow-sm border border-[var(--color-border)] p-6 md:p-8"
            >
              <h2 className="text-2xl font-bold mb-6">Notification Preferences</h2>
              
              <div className="space-y-6">
                {/* Email Notifications */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Email Notifications</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-medium">Listing Updates</p>
                        <p className="text-sm text-gray-600">Get notified when your listing status changes</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifListingUpdates}
                        onChange={(e) => setNotifListingUpdates(e.target.checked)}
                        className="w-5 h-5"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-medium">Order Notifications</p>
                        <p className="text-sm text-gray-600">Updates about your orders and purchases</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifOrders}
                        onChange={(e) => setNotifOrders(e.target.checked)}
                        className="w-5 h-5"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-medium">Trust Lens Updates</p>
                        <p className="text-sm text-gray-600">Verification status and reviews</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifTrustLens}
                        onChange={(e) => setNotifTrustLens(e.target.checked)}
                        className="w-5 h-5"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-medium">Marketing Emails</p>
                        <p className="text-sm text-gray-600">Promotions, tips, and feature updates</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifMarketing}
                        onChange={(e) => setNotifMarketing(e.target.checked)}
                        className="w-5 h-5"
                      />
                    </label>
                  </div>
                </div>

                {/* Push Notifications */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold mb-4">Push Notifications</h3>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-medium">Messages</p>
                        <p className="text-sm text-gray-600">New messages from buyers or sellers</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifMessages}
                        onChange={(e) => setNotifMessages(e.target.checked)}
                        className="w-5 h-5"
                      />
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <p className="font-medium">Price Alerts</p>
                        <p className="text-sm text-gray-600">When similar devices drop in price</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifPriceAlerts}
                        onChange={(e) => setNotifPriceAlerts(e.target.checked)}
                        className="w-5 h-5"
                      />
                    </label>
                  </div>
                </div>

                {/* Save Button */}
                {/* DATA-06: Save Preferences is disabled until notification settings API is implemented.
                    The button is visually present but non-functional to avoid a misleading success toast. */}
                <div className="border-t pt-6 flex items-center gap-4">
                  <button
                    type="button"
                    disabled
                    aria-describedby="notif-coming-soon"
                    className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-semibold opacity-50 cursor-not-allowed"
                  >
                    Save Preferences
                  </button>
                  <p id="notif-coming-soon" className="text-sm text-gray-500">Coming soon</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  // Route protection is handled server-side by middleware (jose.jwtVerify).
  // A redundant client-side ProtectedRoute guard was removed here to prevent
  // a redirect loop when the auth-service is slow or temporarily unavailable.
  return <SettingsContent />;
}
