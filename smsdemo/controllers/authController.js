import { createOtpForEmail, verifyOtpForEmail } from '../services/otpService.js';
import { sendOtpEmail } from '../services/emailService.js';
import { generateJwtToken } from '../services/jwtService.js';

import { config } from '../config/index.js';

export async function sendOtp(req, res, next) {
  try {
    const email = req.body.email.toLowerCase();
    console.log(`[Controller] Starting OTP flow for: ${email}`);
    
    console.log(`[Controller] Generating secure OTP...`);
    const otp = await createOtpForEmail(email);
    console.log(`[Controller] OTP generated and stored successfully.`);

    console.log(`[Controller] Handing off to Email Service...`);
    await sendOtpEmail(email, otp);
    console.log(`[Controller] Email service completed.`);

    return res.status(200).json({
      status: 'success',
      message: `OTP sent to ${email}. It will expire in ${config.otp.expirationMinutes} minutes.`
    });
  } catch (error) {
    console.error(`[Controller] Error in sendOtp:`, error.message);
    return next(error);
  }
}

export async function verifyOtp(req, res, next) {
  try {
    const { email, otp } = req.body;
    console.log(`[Controller] Verifying OTP for: ${email}`);
    
    await verifyOtpForEmail(email.toLowerCase(), otp);
    console.log(`[Controller] OTP verification successful.`);

    console.log(`[Controller] Generating JWT session token...`);
    const token = generateJwtToken({ email: email.toLowerCase() });
    
    return res.status(200).json({
      status: 'success',
      token,
      expiresIn: config.jwtExpiresIn
    });
  } catch (error) {
    console.error(`[Controller] Verification failed for ${req.body.email}:`, error.message);
    return next(error);
  }
}

