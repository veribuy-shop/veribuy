import { Ionicons } from '@expo/vector-icons';
import { shortDate, shortName } from '@/src/lib/format';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View, Pressable } from 'react-native';

import { GuestGate } from '@/src/components/GuestGate';
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

function threadTitle(thread: Thread, userId?: string): string {
  const last = thread.lastMessage;
  if (last.isSystem) return 'VeriBuy updates';
  return shortName(last.senderId === userId ? last.recipient?.name : last.sender?.name);
}

function unreadIn(thread: Thread, userId?: string): boolean {
  return thread.messages.some((m) => m.recipientId === userId && !m.isRead);
}

function threadIcon(thread: Thread): keyof typeof Ionicons.glyphMap {
  return thread.lastMessage.isSystem ? 'notifications-outline' : 'person-outline';
}

export default function MessagesScreen() {
  const { user, isAuthenticated } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await messagesService.mine(user.id, { limit: 100 });
      const map = new Map<string, Thread>();
      for (const m of res.data) {
        // Automated notices form one thread, and a sender never sees their own.
        if (m.isSystem && m.senderId === user.id) continue;
        const otherId = m.senderId === user.id ? (m as any).recipientId : m.senderId;
        if (!otherId) continue;
        const key = m.isSystem ? 'system' : otherId + (m.listingId ? `:${m.listingId}` : '');
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

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!isAuthenticated) {
    return (
      <GuestGate
        title="Message buyers and sellers"
        subtitle="Sign in to chat with sellers, ask device condition questions, and follow your offers."
        icon="chatbubble-ellipses-outline"
      />
    );
  }

  return (
    <Screen safeTop>
      <Text className="text-[28px] font-bold text-text mb-3">Messages</Text>
      <FlatList
        data={threads}
        keyExtractor={(item) => (item.lastMessage.isSystem ? 'system' : item.otherUserId + (item.listingId || ''))}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              item.lastMessage.isSystem
                ? router.push('/updates')
                : router.push({
                pathname: '/conversation/[otherUserId]',
                params: {
                  otherUserId: item.otherUserId,
                  title: threadTitle(item, user?.id),
                  ...(item.listingId ? { listingId: item.listingId } : {}),
                },
              })
            }
            className="bg-surface rounded-2xl border border-borderc p-3.5 mb-2 active:opacity-90"
          >
            <View className="flex-row items-center">
              <View className="w-11 h-11 rounded-full bg-surface-container items-center justify-center mr-3">
                <Ionicons name={threadIcon(item)} size={20} color="#232F3E" />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="flex-1 text-[15px] font-semibold text-text mr-2" numberOfLines={1}>
                    {threadTitle(item, user?.id)}
                  </Text>
                  <Text className="text-xs text-text-subtle">{shortDate(item.lastMessage.createdAt)}</Text>
                </View>
                {item.lastMessage.listing?.title ? (
                  <Text className="text-xs text-text-subtle mt-0.5" numberOfLines={1}>{item.lastMessage.listing.title}</Text>
                ) : null}
                <Text
                  className={`text-sm mt-0.5 ${unreadIn(item, user?.id) ? 'font-semibold text-text' : 'text-text-muted'}`}
                  numberOfLines={1}
                >
                  {item.lastMessage.content}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? undefined : <EmptyState title="No messages yet" subtitle="Start a conversation from a listing." />
        }
      />
    </Screen>
  );
}
