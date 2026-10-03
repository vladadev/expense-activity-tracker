import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationsContext';

const styles = StyleSheet.create({
  button: { padding: 4, marginLeft: 8 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

// `color` is for the headers that sit on the pond rather than on a surface:
// there the default ink is nearly the colour of the water behind it.
export default function NotificationBell({ color }) {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const { unreadCount } = useNotifications();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={styles.button}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="notifications-outline" size={24} color={color || theme.text} />
      {unreadCount > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.danger, borderColor: color || theme.surface }]}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
