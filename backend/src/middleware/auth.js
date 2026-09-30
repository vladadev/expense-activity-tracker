const mongoose = require('mongoose');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');
const Membership = require('../models/Membership');

// Resolves the caller AND the household whose data they're allowed to touch.
//
// The household is read from the database on each request rather than being
// baked into the JWT: a token lives for 30 days, so a user who joins or
// leaves a household mid-token would otherwise keep querying the old one
// until they happened to log in again.
//
// Which household is decided by the REQUEST, through the X-Household-Id
// header, and not by a server-side "currently active" value. The reason is the
// offline queue: a write made in one household can sit on a phone for days and
// be sent long after its author has switched somewhere else. A header is
// written into the request at the moment the person pressed save, so it lands
// where it was meant to. Server-side state would land it wherever they happen
// to be standing when the network finally comes back.
//
// The header is never trusted on its own. It only names a household; whether
// the caller may touch it is decided here, by looking for a live membership.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const user = await User.findById(payload.sub).select('name household');
  if (!user) {
    return res.status(401).json({ error: 'Account no longer exists' });
  }

  req.userId = user._id;
  req.userName = user.name;

  const requested = req.headers['x-household-id'];

  if (requested) {
    if (!mongoose.Types.ObjectId.isValid(requested)) {
      return res.status(400).json({ error: 'Invalid household id' });
    }
    const membership = await Membership.findOne({
      user: user._id,
      household: requested,
      status: 'active',
    });
    // 403 rather than 404: saying "not found" for a household that exists but
    // belongs to someone else tells the caller it exists.
    if (!membership) {
      return res.status(403).json({ error: 'You are not a member of that household', code: 'NOT_A_MEMBER' });
    }
    req.householdId = membership.household;
    return next();
  }

  // No header: an app version that predates households being plural, or the
  // first request after signing in, before the list has been fetched.
  //
  // The MOST RECENTLY joined one, not the oldest. Under the old rules joining
  // a household moved you into it, and an app that does not send the header
  // still expects that: landing it in the household it started with would make
  // joining look like it had silently failed.
  const first = await Membership.findOne({ user: user._id, status: 'active' }).sort({ joinedAt: -1 });
  // The legacy field is the last resort, for an account whose memberships have
  // not been migrated yet.
  req.householdId = first ? first.household : user.household || null;
  next();
}

// For the routes that read or write household-scoped data. Kept separate from
// requireAuth so the few endpoints that legitimately run without a household
// (creating one, joining one by code) can still be reached.
function requireHousehold(req, res, next) {
  if (!req.householdId) {
    return res.status(409).json({ error: 'No household yet', code: 'NO_HOUSEHOLD' });
  }
  next();
}

module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.requireHousehold = requireHousehold;
