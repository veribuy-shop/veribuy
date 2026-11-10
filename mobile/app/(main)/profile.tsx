import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';

import { openLegalPage } from '@/src/lib/legal';
import { GuestGate } from '@/src/components/GuestGate';
import { Button, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { PayoutAccountStatus, payoutsService, usersService } from '@/src/services';
import { ReferralSummary } from '@/src/types/entities';

export default function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loadingRef, setLoadingRef] = useState(false);

  const loadReferrals = useCallback(async () => {
    if (!user?.id) return;
    setLoadingRef(true);
    try {
      const data = await usersService.getReferrals(user.id);
      setSummary(data);
    } catch {
      // Non-fatal if referral service is slow or not yet populated
    } finally {
      setLoadingRef(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const [payoutAccount, setPayoutAccount] = useState<PayoutAccountStatus | null>(null);
  const [openingPayouts, setOpeningPayouts] = useState(false);

  const loadPayoutAccount = useCallback(async () => {
    if (!user?.id) return;
    try {
      setPayoutAccount(await payoutsService.getAccount());
    } catch {
      // Non-fatal: the button still opens setup.
    }
  }, [user?.id]);

  useEffect(() => {
    loadPayoutAccount();
  }, [loadPayoutAccount]);

  const onOpenPayouts = async () => {
    setOpeningPayouts(true);
    try {
      const { url } = payoutAccount?.payoutsEnabled
        ? await payoutsService.createDashboardLink()
        : await payoutsService.createOnboardingLink();
      await WebBrowser.openBrowserAsync(url);
      // The seller may have finished setup in the browser; this also sends anything that was waiting.
      await loadPayoutAccount();
    } catch (err: any) {
      Alert.alert('Bank details', err?.message || 'We could not open the secure form. Please try again.');
    } finally {
      setOpeningPayouts(false);
    }
  };

  const referralCode = summary?.referralCode || user?.referralCode || 'VB-VERIBUY';

  const onShareReferral = async () => {
    try {
      const shareUrl = `https://veribuy.shop/register?ref=${referralCode}`;
      await Share.share({
        title: 'Join VeriBuy - Verified Electronics Marketplace',
        message: `Use my invite code ${referralCode} to join VeriBuy and trade electronics with 0% seller fees!\n${shareUrl}`,
        url: shareUrl,
      });
    } catch (err: any) {
      Alert.alert('Share', `Your referral code is: ${referralCode}`);
    }
  };

  const onCopyCode = () => {
    Alert.alert(
      'Referral code',
      `Your code is: ${referralCode}\n\nShare this code with friends to earn £5 on their first device sale!`,
    );
  };

  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Your account and rewards"
        subtitle="Sign in to view your profile, track £5 referral rewards, and manage active listings."
        icon="person-outline"
      />
    );
  }

  return (
    <Screen safeTop>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text className="text-[28px] font-bold text-text mb-4">Account</Text>

        {/* User Card */}
        <View className="bg-surface rounded-2xl border border-borderc p-4 mb-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-lg font-bold text-text">{user?.name}</Text>
              <Text className="text-text-muted text-xs mt-0.5">{user?.email}</Text>
            </View>
            <View className="bg-emerald-100 px-2.5 py-1 rounded-full">
              <Text className="text-[11px] font-bold text-emerald-800">{user?.role === 'ADMIN' ? 'Admin' : user?.role === 'SELLER' ? 'Seller' : 'Member'}</Text>
            </View>
          </View>
        </View>

        {/* Referral Hub Card */}
        <View className="bg-surface rounded-2xl border border-emerald-200 p-4 mb-4 shadow-sm">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-bold text-text">Refer a seller, earn £5</Text>
            <View className="bg-emerald-100 px-2 py-0.5 rounded-full">
              <Text className="text-[11px] font-bold text-emerald-800">£5 reward</Text>
            </View>
          </View>
          
          <Text className="text-xs text-text-muted leading-relaxed mb-3">
            Give friends zero-commission selling. When someone registers with your code and completes their first sale, you receive £5 credited directly to your balance.
          </Text>

          {/* Referral Code Box */}
          <View className="bg-surface-alt border border-dashed border-emerald-300 rounded-xl p-3 flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-[11px] font-bold text-text-muted tracking-wider">Your referral code</Text>
              <Text className="text-lg font-bold text-emerald-700 tracking-wider mt-0.5">
                {referralCode}
              </Text>
            </View>
            <View className="flex-row gap-2">
              <Pressable
                onPress={onCopyCode}
                className="bg-surface border border-borderc px-3 py-1.5 rounded-lg active:opacity-70"
              >
                <Text className="text-xs font-semibold text-text">Copy</Text>
              </Pressable>
              <Pressable
                onPress={onShareReferral}
                className="bg-emerald-600 px-3 py-1.5 rounded-lg active:opacity-70"
              >
                <Text className="text-xs font-semibold text-white">Share</Text>
              </Pressable>
            </View>
          </View>

          {/* Referral Balance & Stats */}
          <View className="flex-row gap-2">
            <View className="flex-1 bg-surface-alt rounded-xl p-2.5 border border-borderc">
              <Text className="text-[11px] text-text-muted font-medium">Earned</Text>
              <Text className="text-base font-bold text-emerald-700 mt-0.5">
                £{(summary?.referralBonusBalance ?? 0).toFixed(2)}
              </Text>
            </View>
            <View className="flex-1 bg-surface-alt rounded-xl p-2.5 border border-borderc">
              <Text className="text-[11px] text-text-muted font-medium">Referred</Text>
              <Text className="text-base font-bold text-text mt-0.5">
                {summary?.referrals?.length ?? 0}
              </Text>
            </View>
            <View className="flex-1 bg-surface-alt rounded-xl p-2.5 border border-borderc">
              <Text className="text-[11px] text-text-muted font-medium">Qualified</Text>
              <Text className="text-base font-bold text-primary mt-0.5">
                {summary?.qualifiedCount ?? 0}
              </Text>
            </View>
          </View>

          {/* Activity / Referred Users List */}
          {summary && summary.referrals.length > 0 ? (
            <View className="mt-3.5 border-t border-borderc pt-3">
              <Text className="text-xs font-bold text-text mb-2">Referral activity</Text>
              {summary.referrals.map((ref) => (
                <View
                  key={ref.id}
                  className="flex-row items-center justify-between py-1.5 border-b border-borderc/40 last:border-b-0"
                >
                  <View>
                    <Text className="text-xs font-medium text-text">
                      {ref.referredUser?.name || 'Referred friend'}
                    </Text>
                    <Text className="text-[11px] text-text-muted">
                      {new Date(ref.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Text className="text-xs font-bold text-emerald-600">+£5.00</Text>
                    <View
                      className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                        ref.status === 'QUALIFIED' || ref.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      <Text
                        className={`text-[11px] font-semibold ${
                          ref.status === 'QUALIFIED' || ref.status === 'PAID'
                            ? 'text-emerald-800'
                            : 'text-amber-800'
                        }`}
                      >
                        {ref.status}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* Admin Dashboard if applicable */}
        {user?.role === 'ADMIN' ? (
          <Pressable
            onPress={() => router.push('/admin')}
            className="bg-primary rounded-xl py-3 px-4 mb-3 active:opacity-80"
          >
            <Text className="text-white font-semibold text-center text-sm">Admin dashboard</Text>
          </Pressable>
        ) : null}

        <Button variant="secondary" onPress={() => router.push('/my-listings')}>
          Your listings
        </Button>

        <View style={{ height: 10 }} />

        <Button variant="secondary" onPress={() => router.push('/offers')}>
          Offers
        </Button>

        <View style={{ height: 10 }} />

        <Button variant="secondary" onPress={onOpenPayouts} disabled={openingPayouts}>
          {payoutAccount?.payoutsEnabled
            ? 'Manage bank details'
            : payoutAccount?.connected
              ? 'Finish adding bank details to get paid'
              : 'Add bank details to get paid'}
        </Button>

        <View style={{ height: 10 }} />

        <Button variant="secondary" onPress={() => router.push('/profile-edit')}>
          Edit profile
        </Button>

        <View style={{ height: 10 }} />

        <Button variant="outline" onPress={() => logout()}>
          Sign out
        </Button>

        <Pressable onPress={() => router.push('/close-account')} accessibilityRole="button" className="items-center py-4 mt-1">
          <Text className="text-sm font-medium text-danger">Close my account</Text>
        </Pressable>

        <View className="flex-row justify-center mb-6">
          <Pressable onPress={() => openLegalPage('privacy')} accessibilityRole="link" className="min-h-11 justify-center px-3">
            <Text className="text-[13px] font-medium text-text-muted">Privacy Policy</Text>
          </Pressable>
          <Pressable onPress={() => openLegalPage('terms')} accessibilityRole="link" className="min-h-11 justify-center px-3">
            <Text className="text-[13px] font-medium text-text-muted">Terms of Service</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}
