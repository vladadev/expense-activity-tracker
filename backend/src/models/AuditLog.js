const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    household: { type: mongoose.Schema.Types.ObjectId, ref: 'Household', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true }, // denormalized so history reads even if user is later removed
    action: {
      type: String,
      enum: ['login', 'logout', 'create', 'update', 'delete'],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['auth', 'expense', 'event', 'pushToken', 'category', 'savings', 'wishlistCategory', 'wishlistItem', 'income'],
      required: true,
    },
    entityId: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null }, // e.g. changed fields, before/after
  },
  { timestamps: true } // createdAt IS the "when" for this action
);

auditLogSchema.index({ household: 1, createdAt: -1 });

// Retention policy: audit logs are ~70% of all stored data and grow ~3x
// faster than the records they describe, so they're the first thing that
// would exhaust the storage tier. This TTL index makes MongoDB delete each
// entry automatically once it's older than the window below — no cron job,
// no manual cleanup. The history screen only ever shows recent activity, so
// nothing user-visible is lost.
const RETENTION_DAYS = Number(process.env.AUDIT_LOG_RETENTION_DAYS || 365);
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
