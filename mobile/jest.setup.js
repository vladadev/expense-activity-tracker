// AsyncStorage is a native module, so under jest it throws the moment it is
// imported — and it is imported by nearly every context. The library ships an
// in-memory mock for exactly this; registering it here keeps the mock out of
// each individual test.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Sentry talks to a native SDK that does not exist here, and a test that
// happens to log an error should not try to ship it anywhere.
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  wrap: (component) => component,
  ReactNativeTracing: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
}));
