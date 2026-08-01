const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, api, createUser, uniqueEmail } = require('./helpers');

before(async () => {
  const { dbName } = await startTestServer();
  console.log(`  (tests running against "${dbName}")`);
});
after(stopTestServer);

describe('registration', () => {
  test('creates an account with its own household', async () => {
    const { user } = await createUser('Alice');
    assert.equal(user.name, 'Alice');
    assert.ok(user.household, 'new account should be given a household');
  });

  test('two signups land in different households', async () => {
    const a = await createUser('First');
    const b = await createUser('Second');
    assert.notEqual(String(a.user.household), String(b.user.household));
  });

  test('seeds default categories for the new household', async () => {
    const { token } = await createUser('Seeded');
    const res = await api('/api/categories?scope=expense', {}, token);
    assert.equal(res.status, 200);
    assert.ok(res.body.categories.length > 0, 'expected starter categories');
  });

  test('rejects a password shorter than 8 characters', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Short', email: uniqueEmail('short'), password: 'abc' },
    });
    assert.equal(res.status, 400);
  });

  test('rejects a malformed email', async () => {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Bad', email: 'not-an-email', password: 'password123' },
    });
    assert.equal(res.status, 400);
  });

  test('rejects a duplicate email', async () => {
    const { email } = await createUser('Original');
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: { name: 'Copy', email, password: 'password123' },
    });
    assert.equal(res.status, 409);
  });
});

describe('login', () => {
  test('succeeds with the right password and returns the household', async () => {
    const { email } = await createUser('LoginOk');
    const res = await api('/api/auth/login', { method: 'POST', body: { email, password: 'password123' } });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.ok(res.body.user.household);
  });

  test('rejects a wrong password', async () => {
    const { email } = await createUser('LoginBad');
    const res = await api('/api/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } });
    assert.equal(res.status, 401);
  });

  test('resists NoSQL operator injection', async () => {
    // Without a type check, { $ne: null } would match the first user in the
    // collection and hand out a token for an account the caller never proved.
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: { email: { $ne: null }, password: { $ne: null } },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.token, undefined);
  });
});

describe('authorization', () => {
  test('rejects requests with no token', async () => {
    const res = await api('/api/expenses');
    assert.equal(res.status, 401);
  });

  test('rejects a forged token', async () => {
    const res = await api('/api/expenses', {}, 'not.a.real.token');
    assert.equal(res.status, 401);
  });
});
