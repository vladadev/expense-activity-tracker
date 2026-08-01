process.env.NODE_ENV = 'test';
require('dotenv').config();

const mongoose = require('mongoose');
const { resolveUri } = require('../src/config/db');

let server;
let baseUrl;
const createdEmails = [];

// Hard stop: these tests delete data, so they must never reach production.
// Checked before anything connects, not as a courtesy warning afterwards.
function assertSafeDatabase() {
  const uri = resolveUri();
  if (!uri) throw new Error('No database URI resolved — is backend/.env present?');
  const dbName = (uri.replace(/\/\/[^@]+@/, '//').split('/')[3] || '').split('?')[0];
  if (!dbName.endsWith('-dev') && !dbName.endsWith('-test')) {
    throw new Error(
      `REFUSING TO RUN: tests would write to "${dbName}", which is not a -dev/-test database.`
    );
  }
  return dbName;
}

async function startTestServer() {
  const dbName = assertSafeDatabase();
  await mongoose.connect(resolveUri());

  const app = require('../src/app');
  await new Promise((resolve) => {
    // Port 0 lets the OS pick a free one, so parallel runs never collide.
    server = app.listen(0, resolve);
  });
  baseUrl = `http://localhost:${server.address().port}`;
  return { dbName, baseUrl };
}

async function stopTestServer() {
  await cleanupTestData();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
}

// Minimal fetch wrapper: returns status and parsed body instead of throwing,
// so tests can assert on error responses as easily as successful ones.
async function api(path, options = {}, token) {
  const res = await fetch(baseUrl + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    // Some endpoints legitimately return no body.
  }
  return { status: res.status, body };
}

let counter = 0;
// Unique per run AND per call, so a re-run never collides with leftovers.
function uniqueEmail(prefix = 'test') {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}@test.invalid`;
}

// Registers a throwaway account and remembers it for teardown.
async function createUser(name = 'Tester') {
  const email = uniqueEmail(name.toLowerCase());
  const res = await api('/api/auth/register', {
    method: 'POST',
    body: { name, email, password: 'password123' },
  });
  if (res.status !== 201) {
    throw new Error(`Could not create test user: ${JSON.stringify(res.body)}`);
  }
  createdEmails.push(email);
  return { token: res.body.token, user: res.body.user, email };
}

// Removes every account these tests made, plus everything in their households.
async function cleanupTestData() {
  if (createdEmails.length === 0) return;
  const db = mongoose.connection.db;
  if (!db) return;

  const users = await db.collection('users').find({ email: { $in: createdEmails } }).toArray();
  const householdIds = [...new Set(users.map((u) => u.household).filter(Boolean))];

  const scoped = ['expenses', 'events', 'incomes', 'savings', 'categories', 'wishlistitems', 'auditlogs'];
  for (const name of scoped) {
    await db.collection(name).deleteMany({ household: { $in: householdIds } });
  }
  await db.collection('households').deleteMany({ _id: { $in: householdIds } });
  await db.collection('users').deleteMany({ email: { $in: createdEmails } });
  createdEmails.length = 0;
}

module.exports = { startTestServer, stopTestServer, api, createUser, cleanupTestData, uniqueEmail };
