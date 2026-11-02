import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useHeaderHeight } from '@react-navigation/elements';
import { FlatList, Text, TextInput, View, KeyboardAvoidingView, Platform, Pressable } from 'react-native';

import { shortDate } from '@/src/lib/format';
import { useAuth } from '@/src/context/AuthContext';
import { messagesService } from '@/src/services';
import { Message } from '@/src/types/entities';

export default function ConversationScreen() {
  const headerHeight = useHeaderHeight();
  const { otherUserId, listingId, title } = useLocalSearchParams<{
    otherUserId: string;
    listingId?: string;
    title?: string;
  }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!otherUserId || !user?.id) return;
    try {
      const res = await messagesService.conversation(user.id, otherUserId, listingId || undefined);
      // Automated notices live under VeriBuy updates; this thread is the two people.
      setMessages(res.data.filter((m) => !m.isSystem));
      setError('');
      // Mark what we've just shown as read so unread counts stay accurate.
      res.data
        .filter((m) => m.recipientId === user.id && !m.isRead)
        .forEach((m) => messagesService.markRead(m.id).catch(() => {}));
    } catch (e: any) {
      setError(e?.message || 'Could not load this conversation.');
    } finally {
      setLoading(false);
    }
  }, [otherUserId, listingId, user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const body = input.trim();
    if (!body || !otherUserId) return;
    setSending(true);
    try {
      await messagesService.send({
        recipientId: otherUserId,
        ...(listingId ? { listingId } : {}),
        content: body,
      });
      setInput('');
      setError('');
      await load();
    } catch (e: any) {
      setError(e?.message || 'Your message was not sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
      className="flex-1 bg-warm-beige"
      style={{ paddingTop: 8 }}
    >
      {title ? <Stack.Screen options={{ title }} /> : null}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        className="px-4"
        contentContainerStyle={{ paddingVertical: 12 }}
        renderItem={({ item }) => {
          const mine = item.senderId === user?.id;
          return (
            <View
              className={`max-w-[80%] rounded-xl px-3 py-2 mb-2 ${mine ? 'self-end bg-primary' : 'self-start bg-surface border border-borderc'}`}
            >
              <Text className={mine ? 'text-white' : 'text-text'}>{item.content}</Text>
              <Text className={`text-xs mt-0.5 ${mine ? 'text-warm-tan' : 'text-warm-tan'}`}>
                {shortDate(item.createdAt)}
              </Text>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <Text className="text-warm-tan text-center mt-10">Loading…</Text>
          ) : (
            <Text className="text-warm-tan text-center mt-10">No messages yet. Say hello!</Text>
          )
        }
      />
      {error ? (
        <Text accessibilityLiveRegion="polite" className="text-danger text-xs text-center px-4 py-1">
          {error}
        </Text>
      ) : null}
      <View className="flex-row items-center border-t border-borderc bg-surface px-3 py-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor="#8A8A8A"
          multiline
          accessibilityLabel="Message"
          className="flex-1 bg-warm-beige rounded-lg px-3 py-2 text-text"
        />
        <Pressable
          onPress={send}
          disabled={sending || !input.trim()}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          className="ml-2 bg-primary rounded-lg px-4 py-2"
        >
          <Text className="text-white font-semibold">Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
