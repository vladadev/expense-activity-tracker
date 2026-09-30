const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, api, createUser } = require('./helpers');

before(startTestServer);
after(stopTestServer);

// Belonging to several households at once.
//
// The security boundary used to be a field on the user: whatever household it
// pointed at was the one you could touch, and there was no way to ask for
// another. Now the request names the household and the server decides whether
// that is allowed. Everything worth testing here is about that decision being
// made correctly, because getting it wrong means one household reading
// another's money.

// The app sends the household it is acting in on every request.
function as(token, householdId) {
  return { token, headers: { 'X-Household-Id': String(householdId) } };
}

async function call(path, options, auth) {
  return api(path, { ...options, headers: auth.headers }, auth.token);
}

// Writes an expense into a specific household and refuses to continue if the
// write did not take. A read asserted against a write that silently failed
// proves nothing.
async function addExpense(auth, description) {
  const cats = await call('/api/categories?scope=expense', {}, auth);
  assert.equal(cats.status, 200);
  const category = cats.body.categories[0].name;
  const created = await call(
    '/api/expenses',
    { method: 'POST', body: { amount: 2500, category, type: 'together', description } },
    auth
  );
  assert.equal(created.status, 201, `expense creation failed: ${JSON.stringify(created.body)}`);
  return created.body.expense;
}

async function myHouseholds(token) {
  const res = await api('/api/households', {}, token);
  assert.equal(res.status, 200);
  return res.body.households;
}

describe('the household a request acts in', () => {
  test('a member may act in a household they belong to', async () => {
    const user = await createUser('ActsIn');
    const [own] = await myHouseholds(user.token);

    const res = await call('/api/households/mine', {}, as(user.token, own.id));
    assert.equal(res.status, 200);
    assert.equal(String(res.body.household.id), String(own.id));
  });

  // The single most important assertion in this file.
  test('a stranger naming someone else household is refused', async () => {
    const owner = await createUser('BoundaryOwner');
    const stranger = await createUser('BoundaryStranger');
    const [ownersOwn] = await myHouseholds(owner.token);

    const res = await call('/api/households/mine', {}, as(stranger.token, ownersOwn.id));
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'NOT_A_MEMBER');
  });

  test('the refusal covers data, not only the household itself', async () => {
    const owner = await createUser('DataOwner');
    const stranger = await createUser('DataStranger');
    const [ownersOwn] = await myHouseholds(owner.token);

    await addExpense(as(owner.token, ownersOwn.id), 'owner-only');

    const res = await call('/api/expenses', {}, as(stranger.token, ownersOwn.id));
    assert.equal(res.status, 403);
  });

  test('a household id that is not an id at all is rejected, not queried', async () => {
    const user = await createUser('BadId');
    const res = await call('/api/households/mine', {}, as(user.token, 'not-an-object-id'));
    assert.equal(res.status, 400);
  });

  // Phones still running the previous version send no header at all. They must
  // keep working, because the update reaches them after the server changes.
  test('a request with no header still lands somewhere valid', async () => {
    const user = await createUser('NoHeader');
    const res = await api('/api/households/mine', {}, user.token);
    assert.equal(res.status, 200);
    assert.ok(res.body.household.id);
  });
});

describe('joining adds a household instead of moving between them', () => {
  test('the joiner keeps their own and gains the shared one', async () => {
    const owner = await createUser('JoinOwner');
    const joiner = await createUser('JoinJoiner');
    const [joinersOwn] = await myHouseholds(joiner.token);

    const invite = await api('/api/households/invite', { method: 'POST' }, owner.token);
    const joined = await api(
      '/api/households/join',
      { method: 'POST', body: { code: invite.body.inviteCode } },
      joiner.token
    );
    assert.equal(joined.status, 200);

    const households = await myHouseholds(joiner.token);
    assert.equal(households.length, 2);
    const ids = households.map((h) => String(h.id));
    assert.ok(ids.includes(String(joinersOwn.id)), 'their own household should still be there');
    assert.ok(ids.includes(String(joined.body.household.id)), 'the shared one should have been added');
  });

  test('what they write in one household does not appear in the other', async () => {
    const owner = await createUser('SplitOwner');
    const joiner = await createUser('SplitJoiner');
    const [joinersOwn] = await myHouseholds(joiner.token);

    const invite = await api('/api/households/invite', { method: 'POST' }, owner.token);
    const joined = await api(
      '/api/households/join',
      { method: 'POST', body: { code: invite.body.inviteCode } },
      joiner.token
    );
    const shared = joined.body.household.id;

    await addExpense(as(joiner.token, joinersOwn.id), 'kept-private');

    const inShared = await call('/api/expenses', {}, as(joiner.token, shared));
    assert.equal(inShared.status, 200);
    assert.equal(inShared.body.expenses.length, 0, 'a private expense must not show up in the shared household');
  });

  test('joining the same household twice is refused', async () => {
    const owner = await createUser('TwiceOwner');
    const joiner = await createUser('TwiceJoiner');

    const first = await api('/api/households/invite', { method: 'POST' }, owner.token);
    await api('/api/households/join', { method: 'POST', body: { code: first.body.inviteCode } }, joiner.token);

    const second = await api('/api/households/invite', { method: 'POST' }, owner.token);
    const again = await api(
      '/api/households/join',
      { method: 'POST', body: { code: second.body.inviteCode } },
      joiner.token
    );
    assert.equal(again.status, 409);
  });
});

describe('starting another household', () => {
  test('a person can create one and it is theirs alone', async () => {
    const user = await createUser('Creator');
    const created = await api('/api/households', { method: 'POST', body: { name: 'Flat share' } }, user.token);
    assert.equal(created.status, 201);
    assert.equal(created.body.household.name, 'Flat share');

    const households = await myHouseholds(user.token);
    assert.equal(households.length, 2);
    assert.ok(households.some((h) => h.name === 'Flat share'));
  });

  test('a new household comes with its own categories, not the other household ones', async () => {
    const user = await createUser('SeededCreator');
    const created = await api('/api/households', { method: 'POST', body: { name: 'Second' } }, user.token);

    const categories = await call('/api/categories', {}, as(user.token, created.body.household.id));
    assert.equal(categories.status, 200);
    assert.ok(categories.body.categories.length > 0, 'a fresh household should be seeded');
  });

  test('an empty name is refused rather than silently accepted', async () => {
    const user = await createUser('EmptyName');
    const res = await api('/api/households', { method: 'POST', body: { name: '   ' } }, user.token);
    assert.equal(res.status, 400);
  });
});

describe('leaving one of several households', () => {
  async function sharedHousehold(prefix) {
    const owner = await createUser(`${prefix}Owner`);
    const joiner = await createUser(`${prefix}Joiner`);
    const invite = await api('/api/households/invite', { method: 'POST' }, owner.token);
    const joined = await api(
      '/api/households/join',
      { method: 'POST', body: { code: invite.body.inviteCode } },
      joiner.token
    );
    return { owner, joiner, shared: joined.body.household.id, name: joined.body.household.name };
  }

  test('leaving takes away access to that one only', async () => {
    const { joiner, shared, name } = await sharedHousehold('LeaveOne');
    const before = await myHouseholds(joiner.token);
    assert.equal(before.length, 2);

    const left = await call('/api/households/leave', { method: 'POST', body: { confirmName: name } }, as(joiner.token, shared));
    assert.equal(left.status, 200);

    const after = await myHouseholds(joiner.token);
    assert.equal(after.length, 1);
    assert.ok(!after.some((h) => String(h.id) === String(shared)));

    const blocked = await call('/api/households/mine', {}, as(joiner.token, shared));
    assert.equal(blocked.status, 403);
  });

  test('what they wrote stays with the household they left', async () => {
    const { owner, joiner, shared, name } = await sharedHousehold('LeaveHistory');

    await addExpense(as(joiner.token, shared), 'shared-cost-from-a-leaver');

    await call('/api/households/leave', { method: 'POST', body: { confirmName: name } }, as(joiner.token, shared));

    const remaining = await call('/api/expenses', {}, as(owner.token, shared));
    assert.equal(remaining.status, 200);
    assert.ok(
      remaining.body.expenses.some((e) => e.description === 'shared-cost-from-a-leaver'),
      'a shared cost must not disappear from the household because its author left'
    );
  });

  test('the last member cannot leave, there would be nobody to inherit it', async () => {
    const user = await createUser('LastOne');
    const [own] = await myHouseholds(user.token);
    const mine = await call('/api/households/mine', {}, as(user.token, own.id));

    const res = await call(
      '/api/households/leave',
      { method: 'POST', body: { confirmName: mine.body.household.name } },
      as(user.token, own.id)
    );
    assert.equal(res.status, 409);
  });
});

describe('members are listed in the order they joined', () => {
  // Not cosmetic: a member colour is their position in this list, and a colour
  // that moves when somebody else joins is a colour nobody can rely on.
  test('an earlier member stays first after a later one joins', async () => {
    const owner = await createUser('OrderOwner');
    const second = await createUser('OrderSecond');
    const third = await createUser('OrderThird');

    const firstInvite = await api('/api/households/invite', { method: 'POST' }, owner.token);
    const joined = await api(
      '/api/households/join',
      { method: 'POST', body: { code: firstInvite.body.inviteCode } },
      second.token
    );
    const shared = joined.body.household.id;

    const before = await call('/api/households/mine', {}, as(owner.token, shared));
    const orderBefore = before.body.household.members.map((m) => m.name);

    const secondInvite = await api('/api/households/invite', { method: 'POST' }, owner.token);
    await api(
      '/api/households/join',
      { method: 'POST', body: { code: secondInvite.body.inviteCode } },
      third.token
    );

    const after = await call('/api/households/mine', {}, as(owner.token, shared));
    const orderAfter = after.body.household.members.map((m) => m.name);

    assert.deepEqual(orderAfter.slice(0, orderBefore.length), orderBefore);
    assert.equal(orderAfter.length, 3);
  });
});
