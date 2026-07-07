const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
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

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
