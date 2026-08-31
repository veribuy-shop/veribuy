import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, RefreshControl } from 'react-native';

import { Card, EmptyState, LoadingState, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/context/AuthContext';
import { adminService } from '@/src/services';
import { User } from '@/src/types/entities';

export default function AdminScreen() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await adminService.users();
      setUsers(res);
      setError('');
    } catch {
      setError('Could not load users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'ADMIN') load();
  }, [user?.role]);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter((u) => u.role === 'ADMIN').length;
    const sellers = users.filter((u) => u.role === 'SELLER').length;
    const verified = users.filter((u) => u.isEmailVerified).length;
    return { total, admins, sellers, verified };
  }, [users]);

  if (user?.role !== 'ADMIN') {
    return (
      <Screen>
        <Text className="text-danger text-center mt-10">Access denied</Text>
      </Screen>
    );
  }

  return (
    <Screen style={{ paddingTop: 20 }}>
      <Text className="text-2xl font-bold text-primary mb-1">Admin</Text>
      <Text className="text-text-muted mb-4">Platform administration</Text>
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <Text onPress={() => router.back()} className="text-primary mb-3">← Back</Text>

        <Text className="font-semibold text-text mb-2">System Health</Text>
        <Card>
          <Text className="text-text-muted text-sm">See live service status in the web console.</Text>
        </Card>

        <Text className="font-semibold text-text mb-2">Users ({stats.total})</Text>
        <Card>
          <View className="flex-row justify-between mb-1">
            <Text className="text-text-muted text-sm">Admins</Text>
            <Text className="text-text font-semibold text-sm">{stats.admins}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-text-muted text-sm">Sellers</Text>
            <Text className="text-text font-semibold text-sm">{stats.sellers}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-text-muted text-sm">Email verified</Text>
            <Text className="text-text font-semibold text-sm">{stats.verified} / {stats.total}</Text>
          </View>
        </Card>

        {error ? <Text className="text-danger text-sm mb-2">{error}</Text> : null}

        {loading ? (
          <LoadingState />
        ) : users.length === 0 ? (
          <EmptyState title="No users" />
        ) : (
          users.map((u) => (
            <View key={u.id} className="bg-surface rounded-xl border border-borderc p-3 mb-2">
              <View className="flex-row items-center justify-between">
                <Text className="text-text font-medium">{u.name}</Text>
                <Text className="text-accent-dark text-xs">{u.role}</Text>
              </View>
              <Text className="text-text-muted text-sm">{u.email}</Text>
              <Text className="text-warm-tan text-xs mt-0.5">
                {u.isEmailVerified ? 'Email verified' : 'Email not verified'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}
