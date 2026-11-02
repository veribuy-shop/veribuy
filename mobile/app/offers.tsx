import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { GuestGate } from '@/src/components/GuestGate';
import { Button, EmptyState, LoadingState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { buyerFacingPrice } from '@/src/lib/fees';
import { Offer, offersService } from '@/src/services';

type Tab = 'received' | 'sent';

const STATUS_STYLES: Record<Offer['status'], { background: string; text: string; label: string }> = {
  PENDING: { background: 'bg-grade-c-bg', text: 'text-grade-c-text', label: 'Waiting for a reply' },
  ACCEPTED: { background: 'bg-emerald-100', text: 'text-emerald-800', label: 'Accepted' },
  DECLINED: { background: 'bg-discount-crimson-bg', text: 'text-danger', label: 'Declined' },
  WITHDRAWN: { background: 'bg-surface-container', text: 'text-text-muted', label: 'Withdrawn' },
  EXPIRED: { background: 'bg-surface-container', text: 'text-text-muted', label: 'Expired' },
  COMPLETED: { background: 'bg-surface-container', text: 'text-text', label: 'Paid' },
};

function payBy(expiresAt: string): string {
  return new Date(expiresAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Offers on the seller's listings and the ones they have made, same as /offers on the web. */
export default function OffersScreen() {
  const { isAuthenticated } = useAuth();
  const [received, setReceived] = useState<Offer[]>([]);
  const [sent, setSent] = useState<Offer[]>([]);
  const [tab, setTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [asSeller, asBuyer] = await Promise.all([offersService.mine('seller'), offersService.mine('buyer')]);
      setReceived(asSeller);
      setSent(asBuyer);
      // Open on whichever side has something to do. Later reloads keep the tab.
      setTab(
        (current) =>
          current ??
          (asSeller.some((offer) => offer.status === 'PENDING') || asBuyer.length === 0 ? 'received' : 'sent'),
      );
      setError('');
    } catch (e: any) {
      setError(e?.message || 'We could not load your offers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const respond = async (offer: Offer, action: 'ACCEPT' | 'DECLINE' | 'WITHDRAW') => {
    setBusyId(offer.id);
    try {
      await offersService.respond(offer.id, action);
      await load();
    } catch (e: any) {
      Alert.alert('Offer not updated', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const confirmAccept = (offer: Offer) => {
    const amount = formatPrice(Number(offer.amount), offer.listing.currency);
    Alert.alert(
      `Accept ${amount}?`,
      `${offer.buyer.name} will have 48 hours to pay. Your listing stays live until they do.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Accept offer', onPress: () => respond(offer, 'ACCEPT') },
      ],
    );
  };

  const confirmDecline = (offer: Offer) => {
    Alert.alert('Decline this offer?', 'The buyer will be told, and this can’t be undone.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => respond(offer, 'DECLINE') },
    ]);
  };

  const confirmWithdraw = (offer: Offer) => {
    Alert.alert('Withdraw your offer?', 'The seller will no longer be able to accept it.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Withdraw', style: 'destructive', onPress: () => respond(offer, 'WITHDRAW') },
    ]);
  };

  if (!isAuthenticated) {
    return <GuestGate title="Sign in to see your offers" subtitle="Offers you've made and received will appear here." />;
  }

  if (loading) return <LoadingState />;

  const activeTab = tab ?? 'received';
  const offers = activeTab === 'received' ? received : sent;

  return (
    <Screen>
      <View className="flex-row mb-3">
        {(['received', 'sent'] as const).map((value) => {
          const selected = activeTab === value;
          return (
            <Pressable
              key={value}
              onPress={() => setTab(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              className={`mr-2 px-4 min-h-10 justify-center rounded-full border ${selected ? 'bg-primary border-primary' : 'bg-surface border-borderc'}`}
            >
              <Text className={`text-[13px] font-semibold ${selected ? 'text-white' : 'text-text'}`}>
                {value === 'received' ? `On your listings (${received.length})` : `You made (${sent.length})`}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={offers}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListHeaderComponent={
          <Text className="text-[13px] text-text-muted leading-[18px] mb-3">
            Accepted offers can be paid at the agreed price within 48 hours. Buyer Protection and Royal Mail shipping are
            added at checkout.
          </Text>
        }
        renderItem={({ item }) => {
          const style = STATUS_STYLES[item.status] ?? STATUS_STYLES.EXPIRED;
          const amount = Number(item.amount);
          const currency = item.listing.currency;
          const busy = busyId === item.id;
          return (
            <View className="bg-surface rounded-2xl border border-borderc p-3.5 mb-2">
              <Pressable onPress={() => router.push(`/listing/${item.listingId}`)} accessibilityRole="link">
                <Text className="text-[15px] font-semibold text-text leading-5" numberOfLines={2}>
                  {item.listing.title}
                </Text>
              </Pressable>
              <View className="flex-row items-center justify-between mt-1.5">
                <Text className="text-[15px] font-bold text-text">{formatPrice(amount, currency)}</Text>
                <View className={`px-2.5 py-0.5 rounded-full ${style.background}`}>
                  <Text className={`text-xs font-semibold ${style.text}`}>{style.label}</Text>
                </View>
              </View>
              <Text className="text-[13px] text-text-muted mt-1">
                Asking {formatPrice(Number(item.listing.price), currency)} ·{' '}
                {activeTab === 'received' ? `from ${item.buyer.name}` : `to ${item.seller.name}`}
              </Text>
              {item.note ? <Text className="text-[13px] text-text-muted mt-1">“{item.note}”</Text> : null}
              {item.status === 'ACCEPTED' && item.expiresAt ? (
                <Text className="text-[13px] font-medium text-emerald-800 mt-1">
                  {activeTab === 'sent' ? 'Pay' : 'Buyer can pay'} by {payBy(item.expiresAt)}
                </Text>
              ) : null}

              {activeTab === 'received' && item.status === 'PENDING' ? (
                <View className="flex-row mt-3">
                  <View className="flex-1 mr-2">
                    <Button variant="green" onPress={() => confirmAccept(item)} loading={busy}>
                      Accept
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button variant="secondary" onPress={() => confirmDecline(item)} disabled={busy}>
                      Decline
                    </Button>
                  </View>
                </View>
              ) : null}

              {activeTab === 'sent' && item.status === 'PENDING' ? (
                <View className="mt-3">
                  <Button variant="secondary" onPress={() => confirmWithdraw(item)} loading={busy}>
                    Withdraw offer
                  </Button>
                </View>
              ) : null}

              {activeTab === 'sent' && item.status === 'ACCEPTED' ? (
                <View className="mt-3">
                  <Button
                    variant="green"
                    onPress={() =>
                      router.push({ pathname: '/checkout', params: { listingId: item.listingId, offerId: item.id } })
                    }
                  >
                    {`Pay ${formatPrice(buyerFacingPrice(amount), currency)} incl. Buyer Protection`}
                  </Button>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title={error ? 'Offers unavailable' : 'No offers yet'}
            subtitle={
              error ||
              (activeTab === 'received'
                ? 'Offers on your listings will appear here.'
                : 'Make an offer on a listing and you can follow it here.')
            }
          />
        }
      />
    </Screen>
  );
}
