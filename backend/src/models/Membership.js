const mongoose = require('mongoose');

// Who belongs to which household.
//
// This used to be a single field on the user, which could answer "which
// household is this person in" and nothing else. Three things need more than
// that: a person can be in several households at once, a person's colour comes
// from the order they joined a PARTICULAR household, and someone who leaves
// has to stay visible on the records they created rather than vanishing from
// months of shared history.
//
// So membership became a thing in its own right, with a beginning and an end.
const membershipSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true, index: true },
    // Decides the member's colour, and the order they are listed in.
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    // Kept as an explicit value rather than inferred from leftAt, because the
    // unique index below has to filter on it. A partial index can filter on a
    // value; it cannot filter on a field being absent.
    status: { type: String, enum: ['active', 'left'], default: 'active', index: true },
  },
  { timestamps: true }
);

// One live membership per person per household. Partial rather than plain
// unique, so that leaving and later rejoining the same household is allowed:
// the old record stays, marked left, and only the active one is constrained.
membershipSchema.index(
  { user: 1, household: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

// The two lookups that happen on nearly every request.
membershipSchema.index({ user: 1, status: 1, joinedAt: 1 });
membershipSchema.index({ household: 1, status: 1, joinedAt: 1 });

module.exports = mongoose.model('Membership', membershipSchema);
