import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { Button, EmptyState, Input, LoadingState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { formatPrice } from '@/src/lib/currency';
import { AdminOrderItem, AdminQueueItem, AdminSummary, adminService } from '@/src/services';

const WEB_ADMIN = 'https://www.veribuy.shop/admin';

function waitingFor(date: string): string {
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
  if (hours < 1) return 'Under an hour';
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function Tile({ label, value, urgent }: { label: string; value: string | number; urgent?: boolean }) {
  return (
    <View className={`w-[48.5%] rounded-2xl border p-3 mb-2 ${urgent ? 'bg-amber-50 border-amber-300' : 'bg-surface border-borderc'}`}>
      <Text className="text-xs font-medium text-text-muted">{label}</Text>
      <Text className="text-2xl font-bold text-text mt-0.5">{value}</Text>
    </View>
  );
}

/** A quick look and review decisions on the go. Refunds and moderation stay on the web, where there's room to check them. */
export default function AdminScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [queue, setQueue] = useState<AdminQueueItem[]>([]);
  const [orders, setOrders] = useState<AdminOrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<AdminQueueItem | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const isAdmin = user?.role === 'ADMIN';

  const load = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const [nextSummary, nextQueue, nextOrders] = await Promise.all([
        adminService.summary(),
        adminService.reviewQueue(),
        adminService.attentionOrders(),
      ]);
      setSummary(nextSummary);
      setQueue(nextQueue);
      setOrders(nextOrders);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'We could not load the admin data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const decide = async (item: AdminQueueItem, status: 'PASSED' | 'FAILED', notes?: string) => {
    setBusyId(item.id);
    try {
      await adminService.decide(item.id, status, notes);
      await load();
    } catch (e: any) {
      Alert.alert('Decision not saved', e?.message || 'Please try again.');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const confirmApprove = (item: AdminQueueItem) => {
    Alert.alert('Approve this listing?', `“${item.title}” goes live, marked as verified.`, [
      { text: 'Not yet', style: 'cancel' },
      { text: 'Approve', onPress: () => decide(item, 'PASSED') },
    ]);
  };

  const submitRejection = async () => {
    if (!rejecting) return;
    if (reason.trim().length < 5) {
      setReasonError('Tell the seller why, so they can fix it.');
      return;
    }
    const item = rejecting;
    setRejecting(null);
    await decide(item, 'FAILED', reason.trim());
  };

  if (!isAdmin) {
    return (
      <Screen>
        <EmptyState title="Admins only" subtitle="This area is for the VeriBuy team." />
      </Screen>
    );
  }
  if (loading) return <LoadingState />;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {error ? (
          <Text accessibilityRole="alert" className="text-sm text-danger mb-3">
            {error}
          </Text>
        ) : null}

        {summary ? (
          <View className="flex-row flex-wrap justify-between mb-2">
            <Tile label="Waiting for review" value={summary.reviewWaiting} urgent={summary.reviewWaiting > 0} />
            <Tile label="Open disputes" value={summary.disputes} urgent={summary.disputes > 0} />
            <Tile label="Posting overdue" value={summary.overduePosting} urgent={summary.overduePosting > 0} />
            <Tile label="Possible duplicates" value={summary.duplicateGroups} urgent={summary.duplicateGroups > 0} />
            <Tile label="Held in escrow" value={formatPrice(summary.heldAmount, 'GBP')} />
          </View>
        ) : null}

        <Text className="text-lg font-bold text-text mb-2">Review queue</Text>
        {queue.length === 0 ? (
          <Text className="text-sm text-text-muted mb-5">Nothing is waiting for review.</Text>
        ) : (
          queue.map((item) => {
            const problems = item.integrityFlags.filter((flag) => flag !== 'CLEAN');
            const busy = busyId === item.id;
            return (
              <View key={item.id} className="bg-surface rounded-2xl border border-borderc p-3 mb-2">
                <Pressable onPress={() => router.push(`/listing/${item.id}`)} accessibilityRole="link" className="flex-row">
                  <View className="w-14 h-14 rounded-xl bg-surface-alt overflow-hidden mr-3">
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} className="w-full h-full" /> : null}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-text leading-5" numberOfLines={2}>
                      {item.title}
                    </Text>
                    <Text className="text-[13px] text-text-muted mt-0.5">
                      {formatPrice(item.price, item.currency)} · {item.sellerName} · {item.photoCount} photos
                    </Text>
                    <Text className="text-[13px] text-text-muted">Waiting {waitingFor(item.createdAt)}</Text>
                    {problems.length > 0 ? (
                      <Text className="text-[13px] font-semibold text-danger mt-0.5">
                        {problems.join(', ').replace(/_/g, ' ').toLowerCase()}
                      </Text>
                    ) : null}
                    {item.possibleDuplicate ? (
                      <Text className="text-[13px] font-semibold text-amber-800 mt-0.5">Possible duplicate</Text>
                    ) : null}
                  </View>
                </Pressable>
                {item.reviewStatus ? (
                  <View className="flex-row mt-3">
                    <View className="flex-1 mr-2">
                      <Button variant="green" onPress={() => confirmApprove(item)} loading={busy}>
                        Approve
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onPress={() => {
                          setReason('');
                          setReasonError('');
                          setRejecting(item);
                        }}
                      >
                        Reject
                      </Button>
                    </View>
                  </View>
                ) : (
                  <Text className="text-[13px] text-text-muted mt-2">No device check has started. Review this one on the website.</Text>
                )}
              </View>
            );
          })
        )}

        <Text className="text-lg font-bold text-text mt-4 mb-2">Orders needing attention</Text>
        {orders.length === 0 ? (
          <Text className="text-sm text-text-muted mb-5">Nothing needs attention.</Text>
        ) : (
          orders.map((order) => (
            <View key={order.id} className="bg-surface rounded-2xl border border-borderc p-3 mb-2">
              <Text className="text-[15px] font-semibold text-text" numberOfLines={2}>
                {order.listingTitle || 'Untitled item'}
              </Text>
              <Text className="text-[13px] font-semibold text-danger mt-0.5">
                {order.postingOverdue ? 'Posting overdue' : 'Disputed'} · {formatPrice(order.totalAmount, order.currency)}
              </Text>
              <Text className="text-[13px] text-text-muted mt-0.5">
                {order.buyerName} bought from {order.sellerName}
              </Text>
            </View>
          ))
        )}

        <Pressable
          onPress={() => WebBrowser.openBrowserAsync(WEB_ADMIN).catch(() => {})}
          accessibilityRole="link"
          className="flex-row items-center justify-center min-h-11 mt-4"
        >
          <Text className="text-sm font-semibold text-green mr-1">Refunds, disputes and listings on the web</Text>
          <Ionicons name="open-outline" size={16} color="#2D7A4F" />
        </Pressable>
      </ScrollView>

      <Modal visible={!!rejecting} transparent animationType="slide" onRequestClose={() => setRejecting(null)}>
        <View className="flex-1 bg-black/60">
          <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
            <View className="flex-1 justify-end">
              <View className="bg-white rounded-t-3xl p-5 pb-10">
                <Text className="text-lg font-bold text-text mb-1">Reject this listing?</Text>
                <Text className="text-[13px] text-text-muted mb-4" numberOfLines={2}>
                  {rejecting?.title}
                </Text>
                <Input
                  label="Reason, shown to the seller"
                  value={reason}
                  onChangeText={(text) => {
                    setReason(text);
                    setReasonError('');
                  }}
                  multiline
                  maxLength={500}
                  error={reasonError || undefined}
                />
                <Button variant="danger" onPress={submitRejection}>
                  Reject listing
                </Button>
                <Pressable onPress={() => setRejecting(null)} accessibilityRole="button" className="min-h-11 items-center justify-center mt-1">
                  <Text className="text-sm font-medium text-text-muted">Keep it in the queue</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Screen>
  );
}
