const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, stopTestServer, api, createUser } = require('./helpers');

before(startTestServer);
after(stopTestServer);

async function makeFolder(token, name, parent) {
  const res = await api(
    '/api/categories',
    { method: 'POST', body: { name, scope: 'todo', ...(parent ? { parent } : {}) } },
    token
  );
  assert.equal(res.status, 201, `folder creation failed: ${JSON.stringify(res.body)}`);
  return res.body.category;
}

async function addItem(token, categoryId, title) {
  const res = await api('/api/wishlist/items', { method: 'POST', body: { category: categoryId, title } }, token);
  assert.equal(res.status, 201, `item creation failed: ${JSON.stringify(res.body)}`);
  return res.body.item;
}

describe('renaming folders', () => {
  test('a folder can be renamed without touching its items', async () => {
    const { token } = await createUser('RenameA');
    const folder = await makeFolder(token, 'Auto');
    await addItem(token, folder._id, 'Zameniti ulje');

    const res = await api('/api/categories/' + folder._id, { method: 'PUT', body: { name: 'Automobil' } }, token);
    assert.equal(res.status, 200);
    assert.equal(res.body.category.name, 'Automobil');

    const items = await api('/api/wishlist/items?category=' + folder._id, {}, token);
    assert.equal(items.body.items.length, 1);
    assert.equal(items.body.items[0].title, 'Zameniti ulje');
  });

  test('renaming onto an existing sibling name is rejected', async () => {
    const { token } = await createUser('RenameB');
    await makeFolder(token, 'Auto');
    const stan = await makeFolder(token, 'Stan');

    const res = await api('/api/categories/' + stan._id, { method: 'PUT', body: { name: 'Auto' } }, token);
    assert.equal(res.status, 409);
  });

  test('the same name is allowed in two different parents', async () => {
    const { token } = await createUser('RenameC');
    const auto = await makeFolder(token, 'Auto');
    const stan = await makeFolder(token, 'Stan');
    await makeFolder(token, 'Servis', auto._id);

    const res = await api(
      '/api/categories',
      { method: 'POST', body: { name: 'Servis', scope: 'todo', parent: stan._id } },
      token
    );
    assert.equal(res.status, 201);
  });
});

describe('moving folders', () => {
  test('a root folder can be moved into another folder', async () => {
    const { token } = await createUser('MoveA');
    const auto = await makeFolder(token, 'Auto');
    const golf = await makeFolder(token, 'Golf 7');

    const res = await api('/api/categories/' + golf._id, { method: 'PUT', body: { parent: auto._id } }, token);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(String(res.body.category.parent), String(auto._id));
  });

  test('a subfolder can be moved back out to the root', async () => {
    const { token } = await createUser('MoveB');
    const auto = await makeFolder(token, 'Auto');
    const golf = await makeFolder(token, 'Golf 7', auto._id);

    const res = await api('/api/categories/' + golf._id, { method: 'PUT', body: { parent: null } }, token);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.category.parent, null);
  });

  test('a folder cannot be moved into itself', async () => {
    const { token } = await createUser('MoveC');
    const auto = await makeFolder(token, 'Auto');

    const res = await api('/api/categories/' + auto._id, { method: 'PUT', body: { parent: auto._id } }, token);
    assert.equal(res.status, 400);
  });

  // The one that actually loses data: without the descendant check the parent
  // and child point at each other and the whole branch drops out of the tree.
  test('a folder cannot be moved into its own subfolder', async () => {
    const { token } = await createUser('MoveD');
    const auto = await makeFolder(token, 'Auto');
    const golf = await makeFolder(token, 'Golf 7', auto._id);

    const res = await api('/api/categories/' + auto._id, { method: 'PUT', body: { parent: golf._id } }, token);
    assert.equal(res.status, 400);

    const all = await api('/api/categories?scope=todo', {}, token);
    const roots = all.body.categories.filter((c) => c.parent == null);
    assert.ok(roots.some((c) => String(c._id) === String(auto._id)), 'Auto must still be reachable from the root');
  });

  test('nesting deeper than two levels is rejected', async () => {
    const { token } = await createUser('MoveE');
    const auto = await makeFolder(token, 'Auto');
    const golf = await makeFolder(token, 'Golf 7', auto._id);
    const other = await makeFolder(token, 'Gume');

    const viaMove = await api('/api/categories/' + other._id, { method: 'PUT', body: { parent: golf._id } }, token);
    assert.equal(viaMove.status, 400);

    const viaCreate = await api(
      '/api/categories',
      { method: 'POST', body: { name: 'Zimske', scope: 'todo', parent: golf._id } },
      token
    );
    assert.equal(viaCreate.status, 400);
  });

  test('a folder that has subfolders cannot itself become a subfolder', async () => {
    const { token } = await createUser('MoveF');
    const auto = await makeFolder(token, 'Auto');
    await makeFolder(token, 'Golf 7', auto._id);
    const stan = await makeFolder(token, 'Stan');

    const res = await api('/api/categories/' + auto._id, { method: 'PUT', body: { parent: stan._id } }, token);
    assert.equal(res.status, 400);
  });

  test('moving into a parent that already has that name is rejected', async () => {
    const { token } = await createUser('MoveG');
    const auto = await makeFolder(token, 'Auto');
    await makeFolder(token, 'Servis', auto._id);
    const loose = await makeFolder(token, 'Servis');

    const res = await api('/api/categories/' + loose._id, { method: 'PUT', body: { parent: auto._id } }, token);
    assert.equal(res.status, 409);
  });

  test('a folder from another household cannot be used as a parent', async () => {
    const a = await createUser('MoveH1');
    const b = await createUser('MoveH2');
    const mine = await makeFolder(a.token, 'Auto');
    const theirs = await makeFolder(b.token, 'Njihov');

    const res = await api('/api/categories/' + mine._id, { method: 'PUT', body: { parent: theirs._id } }, a.token);
    assert.equal(res.status, 400);
  });
});

describe('moving items between folders', () => {
  test('an item can be moved into a subfolder', async () => {
    const { token } = await createUser('ItemMoveA');
    const auto = await makeFolder(token, 'Auto');
    const golf = await makeFolder(token, 'Golf 7', auto._id);
    const item = await addItem(token, auto._id, 'Zameniti ulje');

    const res = await api('/api/wishlist/items/' + item._id, { method: 'PUT', body: { category: golf._id } }, token);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const inGolf = await api('/api/wishlist/items?category=' + golf._id, {}, token);
    assert.equal(inGolf.body.items.length, 1);
    const inAuto = await api('/api/wishlist/items?category=' + auto._id, {}, token);
    assert.equal(inAuto.body.items.length, 0);
  });

  test('an item cannot be moved into another household folder', async () => {
    const a = await createUser('ItemMoveB1');
    const b = await createUser('ItemMoveB2');
    const mine = await makeFolder(a.token, 'Auto');
    const theirs = await makeFolder(b.token, 'Njihov');
    const item = await addItem(a.token, mine._id, 'Nesto');

    const res = await api('/api/wishlist/items/' + item._id, { method: 'PUT', body: { category: theirs._id } }, a.token);
    assert.equal(res.status, 400);
  });
});

describe('reordering folders', () => {
  test('a valid reorder is persisted', async () => {
    const { token } = await createUser('OrderA');
    const first = await makeFolder(token, 'Prvi');
    const second = await makeFolder(token, 'Drugi');

    const res = await api(
      '/api/categories/reorder',
      { method: 'PUT', body: { ids: [second._id, first._id] } },
      token
    );
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const all = await api('/api/categories?scope=todo', {}, token);
    const order = all.body.categories
      .filter((c) => c.parent == null)
      .sort((a, b) => a.order - b.order)
      .map((c) => c.name);
    assert.deepEqual(order, ['Drugi', 'Prvi']);
  });

  // The one that hung the server. A client reordering while a create is still
  // in flight sends the placeholder id it is using locally; casting that to an
  // ObjectId throws, and an unhandled throw in an async Express 4 route means
  // the request never gets a response at all — which the offline queue reads
  // as "no connection" and retries forever.
  test('a placeholder id is refused rather than left to hang', async () => {
    const { token } = await createUser('OrderB');
    const real = await makeFolder(token, 'Stvarni');

    const res = await api(
      '/api/categories/reorder',
      { method: 'PUT', body: { ids: [real._id, 'temp-cat-1'] } },
      token
    );
    assert.equal(res.status, 400, 'must answer, and must not accept the id');
    assert.ok(res.body.error, 'the answer must say something the caller can use');
  });

  test('an empty or missing ids array is refused', async () => {
    const { token } = await createUser('OrderC');
    const empty = await api('/api/categories/reorder', { method: 'PUT', body: { ids: [] } }, token);
    assert.equal(empty.status, 400);
    const missing = await api('/api/categories/reorder', { method: 'PUT', body: {} }, token);
    assert.equal(missing.status, 400);
  });

  test('the same guard covers list items', async () => {
    const { token } = await createUser('OrderD');
    const folder = await makeFolder(token, 'Lista');
    const item = await addItem(token, folder._id, 'Stavka');

    const ok = await api(
      '/api/wishlist/items/reorder',
      { method: 'PUT', body: { ids: [item._id] } },
      token
    );
    assert.equal(ok.status, 200);

    const bad = await api(
      '/api/wishlist/items/reorder',
      { method: 'PUT', body: { ids: [item._id, 'temp-3'] } },
      token
    );
    assert.equal(bad.status, 400);
  });
});

describe('deleting folders', () => {
  test('deleting a folder removes its subfolders and all their items', async () => {
    const { token } = await createUser('DeleteA');
    const auto = await makeFolder(token, 'Auto');
    const golf = await makeFolder(token, 'Golf 7', auto._id);
    await addItem(token, auto._id, 'Registracija');
    await addItem(token, golf._id, 'Zameniti ulje');

    const res = await api('/api/categories/' + auto._id, { method: 'DELETE' }, token);
    assert.equal(res.status, 200);

    const cats = await api('/api/categories?scope=todo', {}, token);
    assert.ok(!cats.body.categories.some((c) => String(c._id) === String(auto._id)));
    assert.ok(!cats.body.categories.some((c) => String(c._id) === String(golf._id)));

    const items = await api('/api/wishlist/items?category=' + golf._id, {}, token);
    assert.equal(items.body.items.length, 0);
  });
});
