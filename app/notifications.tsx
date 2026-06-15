import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FormToast } from '@/components/motorista/form-toast';
import { SkeletonBox } from '@/components/motorista/skeleton-box';
import { SuwaveColors, SuwaveSpacing } from '@/constants/suwave-theme';
import { useAuth } from '@/contexts/auth-context';
import { DriverNotification, listDriverNotifications } from '@/services/driver-client';
import { formatRelativeTime } from '@/utils/time';

/**
 * Equivalente nativo da tela `notifications` (`NotificationsScreen`) em
 * app/motorista/src/app/page.tsx:5509-5573.
 */
export default function NotificationsScreen() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(() => {
    if (!token) return;
    setIsLoading(true);
    setError('');
    listDriverNotifications(token)
      .then(setNotifications)
      .catch((err) => setError(err instanceof Error ? err.message : 'Não foi possível carregar notificações.'))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Voltar" onPress={() => router.replace('/dashboard')} style={styles.headerButton}>
            <Feather color="#071a36" name="arrow-left" size={22} />
          </Pressable>
          <Text style={styles.title}>Notificações</Text>
          <Pressable accessibilityLabel="Atualizar" onPress={loadNotifications} style={styles.headerButton}>
            <Feather color="#071a36" name="refresh-cw" size={22} />
          </Pressable>
        </View>

        <FormToast message={error} />

        {isLoading ? (
          <View style={{ gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={{ gap: 8, padding: 16, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8edf1' }}>
                <SkeletonBox height={14} width="35%" />
                <SkeletonBox height={18} width="80%" />
                <SkeletonBox height={13} width="60%" />
              </View>
            ))}
          </View>
        ) : null}

        {!isLoading && notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather color="#25c684" name="check-circle" size={34} />
            <Text style={styles.emptyCardTitle}>Nenhuma mensagem nova</Text>
            <Text style={styles.emptyCardText}>
              Quando a equipe SUWAVE enviar avisos sobre cadastro, documentos ou veículo, eles aparecerão aqui.
            </Text>
          </View>
        ) : null}

        {notifications.map((notification) => (
          <View key={notification.id} style={styles.emptyCard}>
            <Text style={styles.emptyCardTitle}>{notification.title}</Text>
            <Text style={styles.emptyCardText}>{notification.body}</Text>
            <Text style={styles.notificationDate}>{formatRelativeTime(notification.created_at)}</Text>
            {notification.action_label ? (
              <Pressable onPress={() => router.replace('/dashboard')}>
                <Text style={styles.actionLink}>{notification.action_label}</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: SuwaveColors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: SuwaveSpacing.screenVerticalTop,
    paddingBottom: SuwaveSpacing.screenVerticalBottom,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 2,
  },
  title: {
    flex: 1,
    fontSize: 26,
    fontWeight: '900',
    color: '#071a36',
    textAlign: 'center',
  },
  empty: {
    fontSize: 14,
    fontWeight: '700',
    color: '#667f90',
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e7eef2',
    borderRadius: 10,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#081a36',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 1,
  },
  emptyCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#073449',
    textAlign: 'center',
  },
  emptyCardText: {
    fontSize: 14,
    lineHeight: 19,
    color: '#667f90',
    textAlign: 'center',
    maxWidth: 310,
  },
  notificationDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9aabb8',
  },
  actionLink: {
    fontSize: 16,
    fontWeight: '700',
    color: SuwaveColors.link,
    textDecorationLine: 'underline',
  },
});
