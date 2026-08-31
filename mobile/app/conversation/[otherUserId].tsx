import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Text, TextInput, View, KeyboardAvoidingView, Platform, Pressable } from 'react-native';

import { useAuth } from '@/src/context/AuthContext';
import { messagesService } from '@/src/services';
import { Message } from '@/src/types/entities';

export default function ConversationScreen() {
  const { otherUserId, listingId } = useLocalSearchParams<{
    otherUserId: string;
    listingId?: string;
  }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!otherUserId) return;
    try {
      const res = await messagesService.conversation(otherUserId, listingId || undefined);
      setMessages(res.data);
    } finally {
      setLoading(false);
    }
  }, [otherUserId, listingId]);

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
      await load();
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-warm-beige"
      style={{ paddingTop: 20 }}
    >
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
                {new Date(item.createdAt).toLocaleTimeString()}
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
      <View className="flex-row items-center border-t border-borderc bg-surface px-3 py-2">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor="#AAAAAA"
          multiline
          className="flex-1 bg-warm-beige rounded-lg px-3 py-2 text-text"
        />
        <Pressable onPress={send} disabled={sending || !input.trim()} className="ml-2 bg-accent rounded-lg px-4 py-2">
          <Text className="text-white font-semibold">Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
