const AuditLog = require('../models/AuditLog');

// Fire-and-forget: an audit log failure should never break the actual
// create/update/delete operation it's recording.
async function logAction({ userId, userName, action, entityType, entityId, details }) {
  try {
    await AuditLog.create({ user: userId, userName, action, entityType, entityId, details });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
