import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View, Pressable } from 'react-native';

import { EmptyState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { messagesService } from '@/src/services';
import { Message } from '@/src/types/entities';

interface Thread {
  otherUserId: string;
  listingId?: string;
  lastMessage: Message;
  messages: Message[];
}

export default function MessagesScreen() {
  const { user } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await messagesService.mine(user.id, { limit: 100 });
      const map = new Map<string, Thread>();
      for (const m of res.data) {
        const otherId = m.senderId === user.id ? (m as any).recipientId : m.senderId;
        if (!otherId) continue;
        const key = otherId + (m.listingId ? `:${m.listingId}` : '');
        const existing = map.get(key);
        if (existing) {
          existing.messages.push(m);
        } else {
          map.set(key, {
            otherUserId: otherId,
            listingId: m.listingId,
            lastMessage: m,
            messages: [m],
          });
        }
      }
      const sorted = Array.from(map.values())
        .map((t) => ({ ...t, messages: t.messages.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) }))
        .sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
      setThreads(sorted);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen style={{ paddingTop: 64 }}>
      <Text className="text-2xl font-bold text-primary mb-3">Messages</Text>
      <FlatList
        data={threads}
        keyExtractor={(item) => item.otherUserId + (item.listingId || '')}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push(`/conversation/${item.otherUserId}${item.listingId ? `?listingId=${item.listingId}` : ''}`)
            }
            className="bg-surface rounded-xl border border-borderc p-4 mb-2"
          >
            <Text className="text-text font-semibold">User {item.otherUserId.slice(0, 8)}</Text>
            <Text className="text-text-muted text-sm mt-1" numberOfLines={1}>
              {item.lastMessage.content}
            </Text>
            <Text className="text-warm-tan text-xs mt-1">
              {new Date(item.lastMessage.createdAt).toLocaleString()}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? null : <EmptyState title="No messages yet" subtitle="Start a conversation from a listing." />
        }
      />
    </Screen>
  );
}
