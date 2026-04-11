import { config } from '../config/index.js';
import { getRedisClient } from '../services/storage/redisClient.js';

const requestTimestamps = new Map();

// Cleanup interval for memory store to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  const intervalMs = config.otp.requestIntervalSeconds * 1000;
  for (const [key, lastRequestAt] of requestTimestamps.entries()) {
    if (now - lastRequestAt > intervalMs) {
      requestTimestamps.delete(key);
    }
  }
}, 60000); // Clean every minute

export async function otpRequestLimiter(req, res, next) {
  const email = req.body?.email?.toLowerCase();
  if (!email) {
    return next();
  }

  const now = Date.now();
  const key = `otp-limit:${email}`;
  const intervalSeconds = config.otp.requestIntervalSeconds;
  const intervalMs = intervalSeconds * 1000;

  const client = await getRedisClient();
  if (client) {
    const lastRequestAt = await client.get(key);
    if (lastRequestAt) {
      const elapsed = now - parseInt(lastRequestAt);
      if (elapsed < intervalMs) {
        const waitSeconds = Math.ceil((intervalMs - elapsed) / 1000);
        const error = new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
        error.statusCode = 429;
        return next(error);
      }
    }
    await client.set(key, now.toString(), { EX: intervalSeconds });
    return next();
  }

  // Memory fallback
  const lastRequestAt = requestTimestamps.get(key) || 0;
  const elapsed = now - lastRequestAt;

  if (elapsed < intervalMs) {
    const waitSeconds = Math.ceil((intervalMs - elapsed) / 1000);
    const error = new Error(`Please wait ${waitSeconds} seconds before requesting another OTP.`);
    error.statusCode = 429;
    return next(error);
  }

  requestTimestamps.set(key, now);
  next();
}

