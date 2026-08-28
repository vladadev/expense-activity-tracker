import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { reportError } from '../utils/errorReporting';

// What this is for.
//
// A JavaScript error thrown while React is rendering has no owner: React
// unmounts the whole tree, and on Android the app simply disappears from the
// screen. That is what a missing import looked like — AgendaScreen called
// useToast() without importing it, and tapping "List" closed the app. Nothing
// told the user what happened, and because the process went down, the report
// often did not survive to be sent either.
//
// A boundary turns that into a screen. The error is reported first, then the
// user is offered a way back instead of a dead app.
//
// It deliberately holds NO dependencies on the app's contexts. This code runs
// precisely when something else has already broken, so it renders with plain
// literal colours: if the theme were the thing that threw, a themed fallback
// would throw again and take the boundary down with it.

const COLORS = {
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  primary: '#3B82F6',
};

// English only, and hardcoded. Reaching for the translation layer here means
// depending on a context that may be exactly what failed.
const COPY = {
  title: 'Something went wrong',
  body: 'This screen could not be opened. The problem has been reported.',
  retry: 'Try again',
};

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // componentStack names the chain of components down to the one that threw,
    // which is what turns "the app closed" into "AgendaScreen threw".
    reportError(error, { boundary: this.props.name || 'root' });
    console.log('Render error caught by boundary:', error?.message, info?.componentStack);
  }

  retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.container}>
        <View style={styles.icon}>
          <Ionicons name="warning-outline" size={30} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>{COPY.title}</Text>
        <Text style={styles.body}>{COPY.body}</Text>
        <TouchableOpacity style={styles.button} onPress={this.retry} activeOpacity={0.8}>
          <Text style={styles.buttonText}>{COPY.retry}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: COLORS.background,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  body: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
    minHeight: 48,
    justifyContent: 'center',
  },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
