const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, api, createUser } = require('./helpers');

before(startTestServer);
after(stopTestServer);

// Convenience: a user plus one expense in their own household.
async function userWithExpense(name, description) {
  const { token, user } = await createUser(name);
  const cats = await api('/api/categories?scope=expense', {}, token);
  const category = cats.body.categories[0].name;
  const created = await api('/api/expenses', {
    method: 'POST',
    body: { amount: 1234, category, type: 'personal', description },
  }, token);
  assert.equal(created.status, 201, `expense creation failed: ${JSON.stringify(created.body)}`);
  return { token, user, expenseId: created.body.expense._id, category };
}

describe('data isolation between households', () => {
  test('a household cannot see another household expenses', async () => {
    const a = await userWithExpense('IsoA', 'a-private');
    const b = await createUser('IsoB');

    const seenByA = await api('/api/expenses', {}, a.token);
    const seenByB = await api('/api/expenses', {}, b.token);

    assert.ok(seenByA.body.expenses.some((e) => e.description === 'a-private'));
    assert.ok(!seenByB.body.expenses.some((e) => e.description === 'a-private'));
    assert.equal(seenByB.body.expenses.length, 0, 'a fresh household starts empty');
  });

  test('stats never include another household spending', async () => {
    const a = await userWithExpense('StatsA', 'a-stats');
    const b = await createUser('StatsB');
    const today = new Date().toISOString().slice(0, 10);

    const statsB = await api(`/api/stats/${today}`, {}, b.token);
    assert.deepEqual(statsB.body.byCurrency, {}, 'B should have no spending at all');

    const statsA = await api(`/api/stats/${today}`, {}, a.token);
    assert.ok(Object.keys(statsA.body.byCurrency).length > 0, 'A should see its own spending');
  });

  test('activity log is scoped to the household', async () => {
    const a = await userWithExpense('LogA', 'a-logged');
    const b = await createUser('LogB');

    const logB = await api('/api/audit-log', {}, b.token);
    assert.ok(
      !logB.body.logs.some((l) => l.details && l.details.description === 'a-logged'),
      'B must not see A activity'
    );
  });

  test('member list only shows your own household', async () => {
    await userWithExpense('MembersA', 'a-members');
    const b = await createUser('MembersB');
    const res = await api('/api/auth/users', {}, b.token);
    assert.equal(res.body.users.length, 1);
  });
});

describe('cross-household access (IDOR)', () => {
  test('cannot read another household expense by guessing its id', async () => {
    const a = await userWithExpense('IdorA', 'a-secret');
    const b = await createUser('IdorB');
    const res = await api(`/api/expenses/${a.expenseId}`, { method: 'PUT', body: { amount: 1 } }, b.token);
    assert.equal(res.status, 404);
  });

  test('cannot delete another household expense', async () => {
    const a = await userWithExpense('IdorDelA', 'a-keepme');
    const b = await createUser('IdorDelB');

    const res = await api(`/api/expenses/${a.expenseId}`, { method: 'DELETE' }, b.token);
    assert.equal(res.status, 404);

    // And the record is genuinely still there afterwards.
    const stillThere = await api('/api/expenses', {}, a.token);
    assert.ok(stillThere.body.expenses.some((e) => e.description === 'a-keepme'));
  });
});

describe('categories', () => {
  test('two households can use the same category name', async () => {
    const a = await createUser('CatA');
    const b = await createUser('CatB');
    const name = `Shared-${Date.now()}`;

    const resA = await api('/api/categories', { method: 'POST', body: { name, scope: 'expense' } }, a.token);
    const resB = await api('/api/categories', { method: 'POST', body: { name, scope: 'expense' } }, b.token);

    assert.equal(resA.status, 201);
    assert.equal(resB.status, 201, 'the unique index must be scoped per household');
  });

  test('a duplicate name inside one household is still rejected', async () => {
    const a = await createUser('CatDup');
    const name = `Dup-${Date.now()}`;
    await api('/api/categories', { method: 'POST', body: { name, scope: 'expense' } }, a.token);
    const again = await api('/api/categories', { method: 'POST', body: { name, scope: 'expense' } }, a.token);
    assert.equal(again.status, 409);
  });
});

describe('invites', () => {
  test('a partner joining gains access to existing data', async () => {
    const a = await userWithExpense('InviteA', 'shared-history');
    const b = await createUser('InviteB');

    const invite = await api('/api/households/invite', { method: 'POST' }, a.token);
    assert.equal(invite.status, 200);
    assert.match(invite.body.inviteCode, /^[A-Z2-9]{6}$/);

    const join = await api('/api/households/join', { method: 'POST', body: { code: invite.body.inviteCode } }, b.token);
    assert.equal(join.status, 200);

    const seenByB = await api('/api/expenses', {}, b.token);
    assert.ok(seenByB.body.expenses.some((e) => e.description === 'shared-history'));
  });

  test('a code cannot be used twice', async () => {
    const a = await createUser('ReuseA');
    const b = await createUser('ReuseB');
    const c = await createUser('ReuseC');

    const invite = await api('/api/households/invite', { method: 'POST' }, a.token);
    await api('/api/households/join', { method: 'POST', body: { code: invite.body.inviteCode } }, b.token);

    const second = await api('/api/households/join', { method: 'POST', body: { code: invite.body.inviteCode } }, c.token);
    assert.equal(second.status, 404);
  });

  test('an unknown code is rejected', async () => {
    const a = await createUser('BadCode');
    const res = await api('/api/households/join', { method: 'POST', body: { code: 'ZZZZZZ' } }, a.token);
    assert.equal(res.status, 404);
  });

  test('a full household refuses further invites', async () => {
    const a = await createUser('FullA');
    const b = await createUser('FullB');
    const invite = await api('/api/households/invite', { method: 'POST' }, a.token);
    await api('/api/households/join', { method: 'POST', body: { code: invite.body.inviteCode } }, b.token);

    const another = await api('/api/households/invite', { method: 'POST' }, a.token);
    assert.equal(another.status, 409);
  });
});

describe('leaving a household', () => {
  async function pairedHousehold() {
    const a = await userWithExpense('LeaveA', 'joint-history');
    const b = await createUser('LeaveB');
    const invite = await api('/api/households/invite', { method: 'POST' }, a.token);
    await api('/api/households/join', { method: 'POST', body: { code: invite.body.inviteCode } }, b.token);
    const mine = await api('/api/households/mine', {}, b.token);
    return { a, b, householdName: mine.body.household.name };
  }

  test('requires the household name typed exactly', async () => {
    const { b } = await pairedHousehold();
    const wrong = await api('/api/households/leave', { method: 'POST', body: { confirmName: 'whatever' } }, b.token);
    assert.equal(wrong.status, 400);

    const empty = await api('/api/households/leave', { method: 'POST', body: {} }, b.token);
    assert.equal(empty.status, 400);
  });

  test('revokes access but preserves shared financial history', async () => {
    const { a, b, householdName } = await pairedHousehold();

    const left = await api('/api/households/leave', { method: 'POST', body: { confirmName: householdName } }, b.token);
    assert.equal(left.status, 200);

    const seenByB = await api('/api/expenses', {}, b.token);
    assert.equal(seenByB.body.expenses.length, 0, 'leaver loses access');

    // The point of the design: deleting the leaver's rows would retroactively
    // falsify the remaining member's past totals.
    const seenByA = await api('/api/expenses', {}, a.token);
    assert.ok(seenByA.body.expenses.some((e) => e.description === 'joint-history'), 'history stays intact');
  });

  test('the leaver lands in a usable fresh household', async () => {
    const { b, householdName } = await pairedHousehold();
    await api('/api/households/leave', { method: 'POST', body: { confirmName: householdName } }, b.token);

    const mine = await api('/api/households/mine', {}, b.token);
    assert.equal(mine.status, 200);
    assert.equal(mine.body.household.members.length, 1);

    const cats = await api('/api/categories?scope=expense', {}, b.token);
    assert.ok(cats.body.categories.length > 0, 'fresh household gets starter categories');
  });

  test('the only member cannot leave', async () => {
    const a = await createUser('SoloLeave');
    const mine = await api('/api/households/mine', {}, a.token);
    const res = await api(
      '/api/households/leave',
      { method: 'POST', body: { confirmName: mine.body.household.name } },
      a.token
    );
    assert.equal(res.status, 409);
  });
});
