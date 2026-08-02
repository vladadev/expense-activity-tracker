const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, api, createUser } = require('./helpers');

before(startTestServer);
after(stopTestServer);

describe('changing a password', () => {
  test('succeeds and the new password works', async () => {
    const { token, email } = await createUser('PwOk');
    const res = await api(
      '/api/auth/change-password',
      { method: 'POST', body: { currentPassword: 'password123', newPassword: 'brand-new-secret' } },
      token
    );
    assert.equal(res.status, 200);

    const withNew = await api('/api/auth/login', { method: 'POST', body: { email, password: 'brand-new-secret' } });
    assert.equal(withNew.status, 200, 'the new password must work');

    const withOld = await api('/api/auth/login', { method: 'POST', body: { email, password: 'password123' } });
    assert.equal(withOld.status, 401, 'the old password must stop working');
  });

  test('rejects a wrong current password', async () => {
    const { token } = await createUser('PwWrong');
    const res = await api(
      '/api/auth/change-password',
      { method: 'POST', body: { currentPassword: 'not-my-password', newPassword: 'something-else-1' } },
      token
    );
    assert.equal(res.status, 401);
  });

  test('rejects a new password shorter than 8 characters', async () => {
    const { token } = await createUser('PwShort');
    const res = await api(
      '/api/auth/change-password',
      { method: 'POST', body: { currentPassword: 'password123', newPassword: 'abc' } },
      token
    );
    assert.equal(res.status, 400);
  });

  test('rejects reusing the current password', async () => {
    const { token } = await createUser('PwSame');
    const res = await api(
      '/api/auth/change-password',
      { method: 'POST', body: { currentPassword: 'password123', newPassword: 'password123' } },
      token
    );
    assert.equal(res.status, 400);
  });

  test('cannot be called without a token', async () => {
    const res = await api('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: 'password123', newPassword: 'whatever-1234' },
    });
    assert.equal(res.status, 401);
  });

  test('one account cannot change another account password', async () => {
    const a = await createUser('PwVictim');
    const b = await createUser('PwAttacker');
    // B's token with A's password: the endpoint only ever acts on the caller,
    // so this changes nothing for A.
    const res = await api(
      '/api/auth/change-password',
      { method: 'POST', body: { currentPassword: 'password123', newPassword: 'hijacked-pass' } },
      b.token
    );
    assert.equal(res.status, 200, 'it changes B, not A');

    const aStillWorks = await api('/api/auth/login', {
      method: 'POST',
      body: { email: a.email, password: 'password123' },
    });
    assert.equal(aStillWorks.status, 200, "A's password must be untouched");
  });
});
