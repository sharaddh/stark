// Centralised config. Fails fast on missing secrets instead of silently
// falling back to a known constant (which would make tokens forgeable).
require('dotenv').config();

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    return null;
  }
  return value;
};

const JWT_SECRET = required('JWT_SECRET');
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  console.error('JWT_SECRET must be set in production. Exiting.');
  process.exit(1);
}
if (!JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set — using an insecure development-only secret.');
}

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || null;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || null;
const razorpayConfigured = Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

module.exports = {
  JWT_SECRET: JWT_SECRET || 'dev-only-insecure-secret',
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  razorpayConfigured,
};
