const mongoose = require('mongoose');

// Picks the database by environment so development and tests can never touch
// production data by accident. Both live on the same Atlas cluster (no extra
// cost) — only the database name differs.
//
//   NODE_ENV=development / test  -> MONGODB_URI_DEV (falls back to <db>-dev)
//   anything else (production)   -> MONGODB_URI
function resolveUri() {
  const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  if (!isDev) return process.env.MONGODB_URI;

  if (process.env.MONGODB_URI_DEV) return process.env.MONGODB_URI_DEV;

  // Derive a dev database name from the production URI rather than requiring
  // a second connection string to be configured by hand.
  const prod = process.env.MONGODB_URI;
  if (!prod) return null;
  return prod.replace(/\/([^/?]+)(\?|$)/, (_, dbName, tail) => `/${dbName}-dev${tail}`);
}

function describe(uri) {
  const withoutCreds = uri.replace(/\/\/[^@]+@/, '//');
  const dbName = (withoutCreds.split('/')[3] || '').split('?')[0] || '(default)';
  return dbName;
}

async function connectDB() {
  const uri = resolveUri();
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env');
  }
  await mongoose.connect(uri);

  const dbName = describe(uri);
  const env = process.env.NODE_ENV || 'production';
  console.log(`MongoDB connected — database "${dbName}" (${env})`);

  // A loud warning beats a silent mistake: if a dev/test run somehow lands on
  // the production database, it should be impossible to miss in the output.
  if ((env === 'development' || env === 'test') && !dbName.endsWith('-dev')) {
    console.warn('WARNING: running in ' + env + ' but connected to a NON-dev database!');
  }
}

module.exports = connectDB;
module.exports.resolveUri = resolveUri;
