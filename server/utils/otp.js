const crypto = require('crypto');
const twilio = require('twilio');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute between sends
const CLEANUP_INTERVAL_MS = 60 * 1000;

// In-memory OTP storage (use Redis in production / multi-instance deployments)
const otps = new Map();

let twilioClient = null;
const getTwilioClient = () => {
  if (twilioClient) return twilioClient;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null; // allow dev boot without Twilio creds
  twilioClient = twilio(sid, token);
  return twilioClient;
};

// Periodically drop expired entries so the Map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of otps) {
    if (record.expiresAt <= now) otps.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

const sendOtp = async (phoneNumber) => {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    throw new Error('Phone number is required');
  }
  if (!/^\+?\d{7,15}$/.test(phoneNumber.trim())) {
    throw new Error('Invalid phone number');
  }
  const phone = phoneNumber.trim();

  const existing = otps.get(phone);
  if (existing && Date.now() - existing.sentAt < RESEND_COOLDOWN_MS) {
    throw new Error('Please wait before requesting another OTP');
  }

  // Cryptographically secure 6-digit OTP
  const otp = crypto.randomInt(100000, 1000000).toString();

  otps.set(phone, {
    otp,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    sentAt: Date.now(),
  });

  const client = getTwilioClient();
  if (!client) {
    // No Twilio configured (local dev): log so the flow stays testable.
    console.warn(`[dev] OTP for ${phone}: ${otp}`);
    return;
  }

  try {
    await client.messages.create({
      body: `Your Stark Strip OTP is: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
  } catch (error) {
    otps.delete(phone); // don't keep an OTP we failed to deliver
    throw error;
  }
};

const verifyOtp = (phoneNumber, otp) => {
  if (typeof phoneNumber !== 'string' || typeof otp !== 'string') return false;
  const phone = phoneNumber.trim();
  const record = otps.get(phone);

  if (!record) return false;

  if (record.expiresAt <= Date.now()) {
    otps.delete(phone);
    return false;
  }

  record.attempts += 1;
  if (record.attempts > MAX_ATTEMPTS) {
    otps.delete(phone); // lock out: brute force is no longer possible
    return false;
  }

  const submitted = String(otp).trim();
  const expected = record.otp;
  // Constant-time comparison to avoid timing side channels
  const valid =
    submitted.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));

  if (valid) otps.delete(phone);
  return valid;
};

module.exports = { sendOtp, verifyOtp };
