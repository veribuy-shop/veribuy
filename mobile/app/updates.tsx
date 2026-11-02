import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { EmptyState, LoadingState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { shortDate } from '@/src/lib/format';
import { messagesService } from '@/src/services';
import { Message } from '@/src/types/entities';

/** Automated order, offer and listing notices, kept apart from conversations with people. */
export default function UpdatesScreen() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await messagesService.mine(user.id, { limit: 100 });
      const mine = res.data.filter((m) => m.isSystem && m.recipientId === user.id);
      setUpdates(mine);
      mine.filter((m) => !m.isRead).forEach((m) => messagesService.markRead(m.id).catch(() => {}));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState />;

  return (
    <Screen>
      <FlatList
        data={updates}
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
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (/offer/i.test(item.subject ?? '')) router.push('/offers');
              else if (item.listingId) router.push(`/listing/${item.listingId}`);
            }}
            className="bg-surface rounded-2xl border border-borderc p-3.5 mb-2 active:opacity-90"
          >
            <View className="flex-row items-start justify-between mb-1">
              <Text className="flex-1 text-[15px] font-semibold text-text mr-2">{item.subject || 'Update'}</Text>
              <Text className="text-xs text-text-subtle">{shortDate(item.createdAt)}</Text>
            </View>
            <Text className="text-sm text-text-muted leading-5">{item.content}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<EmptyState title="No updates yet" subtitle="Order and offer updates will appear here." />}
      />
    </Screen>
  );
}
