const AuditLog = require('../models/AuditLog');
const { pushActionToPartner } = require('./actionPush');

// Fire-and-forget: an audit log failure should never break the actual
// create/update/delete operation it's recording.
async function logAction({ userId, userName, householdId, action, entityType, entityId, details }) {
  try {
    await AuditLog.create({
      user: userId,
      userName,
      household: householdId,
      action,
      entityType,
      entityId,
      details,
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
  // Every logged action also pings the other member of the SAME household
  // (same allowlist as the in-app bell; failures never break the request).
  pushActionToPartner({ userId, userName, householdId, action, entityType, details }).catch((err) =>
    console.error('Failed to send action push:', err.message)
  );
}

module.exports = { logAction };
