import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { CategoriesProvider } from '../context/CategoriesContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { registerForPushNotifications } from '../utils/notifications';

import LoginScreen from '../screens/LoginScreen';
import CalendarScreen from '../screens/CalendarScreen';
import DayDetailScreen from '../screens/DayDetailScreen';
import ExpenseStatsScreen from '../screens/ExpenseStatsScreen';
import ExpenseFormScreen from '../screens/ExpenseFormScreen';
import EventFormScreen from '../screens/EventFormScreen';
import StatsScreen from '../screens/StatsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ActivityLogScreen from '../screens/ActivityLogScreen';
import ManageCategoriesScreen from '../screens/ManageCategoriesScreen';
import SavingsScreen from '../screens/SavingsScreen';
import SavingsFormScreen from '../screens/SavingsFormScreen';
import FinancesScreen from '../screens/FinancesScreen';
import IncomeFormScreen from '../screens/IncomeFormScreen';
import WishlistScreen from '../screens/WishlistScreen';
import WishlistFolderScreen from '../screens/WishlistFolderScreen';
import WishlistItemFormScreen from '../screens/WishlistItemFormScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Every screen renders its own header via the <Screen> component (see
// src/components/Screen.js) instead of the native stack header — the native
// header wasn't reserving status bar space correctly on this device for ANY
// pushed screen, not just stack roots.
const NO_HEADER = { headerShown: false };

function CalendarStack() {
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      <Stack.Screen name="CalendarHome" component={CalendarScreen} />
      <Stack.Screen name="DayDetail" component={DayDetailScreen} />
      <Stack.Screen name="ExpenseStats" component={ExpenseStatsScreen} />
      <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} />
      <Stack.Screen name="EventForm" component={EventFormScreen} />
      <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
    </Stack.Navigator>
  );
}

function FinancesStack() {
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      <Stack.Screen name="FinancesHome" component={FinancesScreen} />
      <Stack.Screen name="SavingsHome" component={SavingsScreen} />
      <Stack.Screen name="SavingsForm" component={SavingsFormScreen} />
      <Stack.Screen name="IncomeForm" component={IncomeFormScreen} />
    </Stack.Navigator>
  );
}

function WishlistStack() {
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      <Stack.Screen name="WishlistHome" component={WishlistScreen} />
      <Stack.Screen name="WishlistFolder" component={WishlistFolderScreen} />
      <Stack.Screen name="WishlistItemForm" component={WishlistItemFormScreen} />
    </Stack.Navigator>
  );
}

function SettingsStack() {
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      <Stack.Screen name="SettingsHome" component={SettingsScreen} />
      <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
      <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
    </Stack.Navigator>
  );
}

const TAB_ICONS = {
  Calendar: 'calendar-outline',
  Stats: 'stats-chart-outline',
  Finances: 'wallet-outline',
  Wishlist: 'heart-outline',
  Settings: 'settings-outline',
};

function MainTabs() {
  const { t } = useSettings();
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Calendar" component={CalendarStack} options={{ tabBarLabel: t('nav.calendar') }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ tabBarLabel: t('nav.stats') }} />
      <Tab.Screen name="Finances" component={FinancesStack} options={{ tabBarLabel: t('nav.finances') }} />
      <Tab.Screen name="Wishlist" component={WishlistStack} options={{ tabBarLabel: t('nav.wishlist') }} />
      <Tab.Screen name="Settings" component={SettingsStack} options={{ tabBarLabel: t('nav.settings') }} />
    </Tab.Navigator>
  );
}

// Wraps the tab navigator so the notification bell (rendered inside every
// screen's shared header) can navigate to "Notifications" from anywhere —
// React Navigation resolves that route by bubbling up to this outer stack,
// regardless of which tab/nested-stack the bell was tapped from.
function AppStack() {
  return (
    <CategoriesProvider>
      <NotificationsProvider>
        <Stack.Navigator screenOptions={NO_HEADER}>
          <Stack.Screen name="Tabs" component={MainTabs} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Navigator>
      </NotificationsProvider>
    </CategoriesProvider>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();

  useEffect(() => {
    if (user) {
      registerForPushNotifications();
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const navigationTheme = {
    ...(theme.isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: theme.background,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      primary: theme.primary,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>{user ? <AppStack /> : <LoginScreen />}</NavigationContainer>
  );
}
