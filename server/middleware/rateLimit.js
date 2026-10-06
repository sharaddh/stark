const rateLimit = require('express-rate-limit');

// Shared helper so every auth surface can be throttled consistently.
// Failed auth is cheap for an attacker and expensive for us (DB + SMS),
// so these limits are intentionally tight.
const makeLimiter = ({ windowMs, max, message }) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
  });

// OTP delivery costs us SMS fees — heavily throttle per IP.
const otpSendLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many OTP requests. Please try again later.',
});

// OTP verification: 6-digit code, 5 attempts per code server-side;
// this caps overall guessing speed per IP.
const otpVerifyLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many verification attempts. Please try again later.',
});

// Login / PIN / registration attempts.
const loginLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

// Generic write throttle for other auth routes (register, profile, etc).
const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many requests. Please try again later.',
});

module.exports = { otpSendLimiter, otpVerifyLimiter, loginLimiter, authLimiter };
