import transporter from '../config/mailConfig.js';
import { createOtpEmailTemplate } from '../utils/emailTemplate.js';
import { config } from '../config/index.js';

export async function sendOtpEmail(to, otp) {
  const html = createOtpEmailTemplate(otp, config.otp.expirationMinutes);

  const message = {
    from: config.email.from,
    to,
    subject: 'Your Secure Login OTP',
    html
  };

  console.log(`[Email Service] Attempting DIRECT SMTP delivery to ${to}...`);

  try {
    const info = await transporter.sendMail(message);
    console.log(`[Email Service] SUCCESS! Email sent via Gmail.`);
    console.log(`[Email Service] Message ID: ${info.messageId}`);
    console.log(`[Email Service] OTP Sent: ${otp}`);
  } catch (error) {
    console.error(`[Email Service] CRITICAL ERROR: Gmail rejected the connection.`);
    console.error(`[Email Service] SMTP Server Message: ${error.message}`);
    throw error; // Throw error to controller so real-time status is returned to user
  }
}



