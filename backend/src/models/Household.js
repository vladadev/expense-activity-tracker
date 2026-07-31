const mongoose = require('mongoose');

// A household is the tenancy boundary of the whole app: every expense, event,
// category, list and audit entry belongs to exactly one, and users only ever
// see data from their own. Before this existed, every account saw every
// record — fine for one couple, impossible once strangers share the server.
const householdSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short human-readable code a partner types to join. Rotatable, and
    // cleared once the household is full.
    inviteCode: { type: String, default: null, uppercase: true, trim: true },
    inviteCodeExpiresAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Partial, NOT sparse. Sparse only skips documents where the field is absent,
// but `default: null` means the field is present-and-null on every household
// without a live code — which made the second such household collide. A
// partial index filters on the value, so only real string codes are indexed.
householdSchema.index(
  { inviteCode: 1 },
  { unique: true, partialFilterExpression: { inviteCode: { $type: 'string' } } }
);

module.exports = mongoose.model('Household', householdSchema);
