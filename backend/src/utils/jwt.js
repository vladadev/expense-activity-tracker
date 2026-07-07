const jwt = require('jsonwebtoken');

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), name: user.name }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
}

function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

module.exports = { signToken, verifyToken };
