import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import client from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Registers this device for push notifications and sends the token to the
// backend so the reminder cron job can deliver birthday/plan reminders.
//
// NOTE: Remote push notifications don't work inside the Expo Go app (Expo
// removed that support in SDK 53+) — they only work in a "development build"
// (a custom-built version of the app installed directly on the phone). This
// function silently no-ops in Expo Go instead of throwing, so the rest of
// the app keeps working normally while testing via Expo Go.
export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
    await client.post('/push-token', { expoPushToken });
  } catch (err) {
    console.log('Push notification registration skipped (expected in Expo Go):', err.message);
  }
}
