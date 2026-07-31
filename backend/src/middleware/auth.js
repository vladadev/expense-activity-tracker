const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// Resolves the caller AND the household whose data they're allowed to touch.
//
// The household is read from the database on each request rather than being
// baked into the JWT: a token lives for 30 days, so a user who joins or
// leaves a household mid-token would otherwise keep querying the old one
// until they happened to log in again. The lookup is a single indexed fetch
// by _id, and can be cached later if it ever shows up in profiling.
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
  req.householdId = user.household || null;
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
