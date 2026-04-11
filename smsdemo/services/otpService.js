import { config } from '../config/index.js';
import { createSecureOtp, hashOtp, safeCompare } from '../utils/otpGenerator.js';
import { saveOtpEntry, getOtpEntry, deleteOtpEntry, incrementOtpAttempts } from './storage/otpStore.js';

export async function createOtpForEmail(email) {
  const otp = createSecureOtp();
  console.log(`[OTP Service] Created new OTP for: ${email}`);
  const hashedOtp = hashOtp(otp, config.otp.hashSecret);
  const expiresAt = Date.now() + config.otp.expirationMinutes * 60 * 1000;
  const entry = {
    email,
    hashedOtp,
    expiresAt,
    attempts: 0,
    createdAt: Date.now()
  };

  await saveOtpEntry(email, entry, config.otp.expirationMinutes * 60);
  console.log(`[OTP Service] Entry saved to storage for ${email}`);
  return otp;
}

export async function verifyOtpForEmail(email, otp) {
  console.log(`[OTP Service] Fetching entry from storage for ${email}...`);
  const entry = await getOtpEntry(email);
  if (!entry) {
    console.error(`[OTP Service] No entry found for ${email} (Expired or never requested)`);
    const error = new Error('OTP is invalid or has expired. Please request a new code.');
    error.statusCode = 401;
    throw error;
  }

  if (Date.now() >= entry.expiresAt) {
    console.warn(`[OTP Service] OTP for ${email} has expired.`);
    await deleteOtpEntry(email);
    const error = new Error('OTP has expired. Please request a new code.');
    error.statusCode = 401;
    throw error;
  }

  const hashedInput = hashOtp(otp, config.otp.hashSecret);
  if (!safeCompare(hashedInput, entry.hashedOtp)) {
    console.warn(`[OTP Service] Invalid OTP attempt for ${email}. Incrementing attempts...`);
    const attempts = await incrementOtpAttempts(email);
    console.log(`[OTP Service] Attempts now at ${attempts}/${config.otp.maxAttempts} for ${email}`);
    if (attempts >= config.otp.maxAttempts) {
      console.error(`[OTP Service] Max attempts reached for ${email}. Deleting entry.`);
      await deleteOtpEntry(email);
      const error = new Error('Maximum OTP attempts exceeded. Request a new code.');
      error.statusCode = 429;
      throw error;
    }

    const error = new Error('OTP is incorrect. Please try again.');
    error.statusCode = 401;
    error.details = [{ attempts, maxAttempts: config.otp.maxAttempts }];
    throw error;
  }

  console.log(`[OTP Service] OTP successfully matched for ${email}.`);
}

