import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ErrorBoundary from '../components/ErrorBoundary';
import PondTabBar from '../components/pond/PondTabBar';
import { IS_DESIGN } from '../theme/variant';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { CategoriesProvider } from '../context/CategoriesContext';
import { NotificationsProvider } from '../context/NotificationsContext';
import { WishlistItemsProvider } from '../context/WishlistItemsContext';
import { DataEventsProvider } from '../context/DataEventsContext';
import { OfflineQueueProvider } from '../context/OfflineQueueContext';
import PendingBanner from '../components/PendingBanner';
import { SkeletonProvider } from '../components/Skeleton';
import { ToastProvider } from '../components/Toast';
import DuoLoader from '../components/duo/DuoLoader';
import { registerForPushNotifications } from '../utils/notifications';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
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
import MoneyScreen from '../screens/MoneyScreen';
import IncomeFormScreen from '../screens/IncomeFormScreen';
import WishlistScreen from '../screens/WishlistScreen';
import WishlistFolderScreen from '../screens/WishlistFolderScreen';
import WishlistItemFormScreen from '../screens/WishlistItemFormScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import HouseholdScreen from '../screens/HouseholdScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import OnboardingScreen, { onboardingKey } from '../screens/OnboardingScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Every screen renders its own header via the <Screen> component (see
// src/components/Screen.js) instead of the native stack header — the native
// header wasn't reserving status bar space correctly on this device for ANY
// pushed screen, not just stack roots.
const NO_HEADER = { headerShown: false };

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
    </Stack.Navigator>
  );
}

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

function StatsStack() {
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      <Stack.Screen name="StatsHome" component={StatsScreen} />
      <Stack.Screen name="ExpenseStats" component={ExpenseStatsScreen} />
      <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} />
    </Stack.Navigator>
  );
}

function FinancesStack() {
  return (
    <Stack.Navigator screenOptions={NO_HEADER}>
      {/* The route keeps its name. In the redesign what sits at it is Money,
          which holds Finances and Stats as its two faces — but every
          navigate('FinancesHome') in the app, and the wallet in the tab bar,
          are keyed on the name, and renaming it would be a rename for the
          sake of one. */}
      <Stack.Screen name="FinancesHome" component={IS_DESIGN ? MoneyScreen : FinancesScreen} />
      <Stack.Screen name="SavingsHome" component={SavingsScreen} />
      <Stack.Screen name="SavingsForm" component={SavingsFormScreen} />
      <Stack.Screen name="IncomeForm" component={IncomeFormScreen} />
      {/* Reachable from the transactions list on Finances, where tapping an
          expense opens it for editing. */}
      <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} />
      {/* The day breakdown the Analysis face opens when a bar is tapped. It
          came in with Stats, which used to be a tab of its own. */}
      {IS_DESIGN && <Stack.Screen name="ExpenseStats" component={ExpenseStatsScreen} />}
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
      <Stack.Screen name="Household" component={HouseholdScreen} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
    </Stack.Navigator>
  );
}

// Each tab is wrapped on its own. A boundary around the whole navigator would
// work, but it would replace the tab bar too — and being able to step into
// another tab is the difference between a broken screen and a broken app.
function guarded(name, Component) {
  return function GuardedTab(props) {
    return (
      <ErrorBoundary name={name}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

const GUARDED = {
  Home: guarded('Home', HomeStack),
  Calendar: guarded('Calendar', CalendarStack),
  Stats: guarded('Stats', StatsStack),
  Finances: guarded('Finances', FinancesStack),
  Wishlist: guarded('Wishlist', WishlistStack),
  Settings: guarded('Settings', SettingsStack),
};

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
      // The pond bar replaces the stock one only in the design build, so the
      // app in daily use keeps the bar it has until the redesign is finished
      // and moved across deliberately.
      tabBar={IS_DESIGN ? (props) => <PondTabBar {...props} /> : undefined}
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
      {/* Home exists only in the design build for now. It is the screen the
          redesign is built around, and the app in daily use keeps opening on
          the calendar until the whole thing moves across together. */}
      {IS_DESIGN && <Tab.Screen name="Home" component={GUARDED.Home} options={{ tabBarLabel: t('nav.home') }} />}
      <Tab.Screen name="Calendar" component={GUARDED.Calendar} options={{ tabBarLabel: t('nav.calendar') }} />
      {/* Statistics is a tab only in the app in daily use. In the redesign it
          is the Analysis face of Money: the answer to "how has it been"
          belongs beside "where do we stand", and two tabs apart meant one was
          opened daily and the other almost never. */}
      {!IS_DESIGN && <Tab.Screen name="Stats" component={GUARDED.Stats} options={{ tabBarLabel: t('nav.stats') }} />}
      <Tab.Screen
        name="Finances"
        component={GUARDED.Finances}
        options={{ tabBarLabel: IS_DESIGN ? t('nav.money') : t('nav.finances') }}
      />
      <Tab.Screen name="Wishlist" component={GUARDED.Wishlist} options={{ tabBarLabel: t('nav.wishlist') }} />
      {/* And settings is your own face in the header — see ProfileButton.
          Opened about once a month, it was taking the same room as the tabs
          opened every day. Four tabs left: Home, Calendar, Money, Lists. */}
      {!IS_DESIGN && (
        <Tab.Screen name="Settings" component={GUARDED.Settings} options={{ tabBarLabel: t('nav.settings') }} />
      )}
    </Tab.Navigator>
  );
}

// Wraps the tab navigator so the notification bell (rendered inside every
// screen's shared header) can navigate to "Notifications" from anywhere —
// React Navigation resolves that route by bubbling up to this outer stack,
// regardless of which tab/nested-stack the bell was tapped from.
function AppStack() {
  return (
    <OfflineQueueProvider>
    <CategoriesProvider>
      <DataEventsProvider>
      <WishlistItemsProvider>
        <NotificationsProvider>
          <SkeletonProvider>
          <ToastProvider>
          <Stack.Navigator screenOptions={NO_HEADER}>
            <Stack.Screen name="Tabs" component={MainTabs} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            {/* Settings sits here, beside Notifications, for the same reason:
                the gear is in the header of every tab, and a route on the
                outer stack is one any of them can reach by bubbling up. It is
                registered only in the design build, where the tab is gone —
                with both, the name would resolve to the tab instead. */}
            {IS_DESIGN && <Stack.Screen name="Settings" component={GUARDED.Settings} />}
          </Stack.Navigator>
          <PendingBanner />
          </ToastProvider>
          </SkeletonProvider>
        </NotificationsProvider>
      </WishlistItemsProvider>
      </DataEventsProvider>
    </CategoriesProvider>
    </OfflineQueueProvider>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  // null = still checking, true/false = whether this account saw the intro.
  const [onboarded, setOnboarded] = useState(null);

  useEffect(() => {
    if (user) {
      registerForPushNotifications();
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setOnboarded(null);
      return;
    }
    AsyncStorage.getItem(onboardingKey(user.id))
      .then((v) => setOnboarded(v === '1'))
      // If storage is unreadable, don't trap the user on the intro forever.
      .catch(() => setOnboarded(true));
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
        <DuoLoader size={64} />
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

  // Onboarding sits outside the navigator: it's a one-time gate, not a
  // destination you can navigate back to.
  if (user && onboarded === false) {
    return <OnboardingScreen onDone={() => setOnboarded(true)} />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>{user ? <AppStack /> : <LoginScreen />}</NavigationContainer>
  );
}
