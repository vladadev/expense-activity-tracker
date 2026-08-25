import { applyDataEvent } from '../src/context/DataEventsContext';

// This is the merge that makes a save feel instant: the form hands over the
// record it just wrote and the list underneath shows it without a round trip.
// A wrong merge shows a duplicate, or a record on a day it does not belong to.
const a = { _id: 'a', title: 'A', date: '2026-08-24' };
const b = { _id: 'b', title: 'B', date: '2026-08-25' };

describe('applyDataEvent', () => {
  it('adds a created record', () => {
    const next = applyDataEvent([a], { action: 'create', entity: b });
    expect(next.map((r) => r._id)).toEqual(['a', 'b']);
  });

  it('replaces on update instead of duplicating', () => {
    const edited = { ...a, title: 'A edited' };
    const next = applyDataEvent([a, b], { action: 'update', entity: edited });
    expect(next).toHaveLength(2);
    expect(next.find((r) => r._id === 'a').title).toBe('A edited');
  });

  it('removes on delete', () => {
    expect(applyDataEvent([a, b], { action: 'delete', entity: a })).toEqual([b]);
  });

  it('deleting something absent is not an error', () => {
    expect(applyDataEvent([a], { action: 'delete', entity: b })).toEqual([a]);
  });

  // A record edited onto another day must leave the day it was showing on,
  // otherwise it lingers in two lists at once until the refetch lands.
  it('drops a record that no longer belongs in this list', () => {
    const moved = { ...a, date: '2026-09-01' };
    const next = applyDataEvent([a, b], {
      action: 'update',
      entity: moved,
    }, { belongs: (r) => r.date === '2026-08-24' });
    expect(next.map((r) => r._id)).toEqual(['b']);
  });

  it('keeps a record that does belong', () => {
    const next = applyDataEvent([b], {
      action: 'create',
      entity: a,
    }, { belongs: (r) => r.date === '2026-08-24' });
    expect(next.map((r) => r._id)).toEqual(['b', 'a']);
  });

  // An optimistic entity can arrive before the server has given it an id.
  it('ignores an event with no entity or no id', () => {
    const list = [a];
    expect(applyDataEvent(list, { action: 'create', entity: null })).toBe(list);
    expect(applyDataEvent(list, { action: 'create', entity: { title: 'X' } })).toBe(list);
  });

  it('does not mutate the list it was given', () => {
    const list = [a, b];
    applyDataEvent(list, { action: 'delete', entity: a });
    expect(list).toEqual([a, b]);
  });
});
