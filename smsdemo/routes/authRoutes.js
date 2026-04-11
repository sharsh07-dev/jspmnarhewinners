import express from 'express';
import { sendOtp, verifyOtp } from '../controllers/authController.js';
import { validateBody } from '../middlewares/validateRequest.js';
import { sendOtpSchema, verifyOtpSchema } from '../utils/validators.js';
import { otpRequestLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.post('/send-otp', otpRequestLimiter, validateBody(sendOtpSchema), sendOtp);
router.post('/verify-otp', validateBody(verifyOtpSchema), verifyOtp);

export default router;
