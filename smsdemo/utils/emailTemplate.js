export function createOtpEmailTemplate(otp, expirationMinutes) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937;">
      <div style="max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="margin: 0; font-size: 28px; color: #111827;">Your One-Time Password</h1>
          <p style="margin: 8px 0 0; color: #6b7280;">Use the code below to complete your authentication.</p>
        </div>

        <div style="padding: 24px; background: #f9fafb; border-radius: 12px; text-align: center;">
          <p style="margin: 0 0 16px; color: #111827; font-size: 18px;">Your secure OTP is:</p>
          <p style="margin: 0; font-size: 40px; letter-spacing: 0.25em; color: #111827; font-weight: 700;">${otp}</p>
        </div>

        <div style="margin-top: 24px; color: #6b7280; font-size: 16px; line-height: 1.6;">
          <p style="margin: 0 0 12px;">This code expires in <strong>${expirationMinutes} minutes</strong>. If you did not request this, please ignore this email.</p>
          <p style="margin: 0;">For security, do not share this code with anyone.</p>
        </div>

        <div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 12px; color: #374151; font-size: 14px;">
          <p style="margin: 0;">If you have trouble signing in, reply to this message and we will help.</p>
        </div>
      </div>
    </div>
  `;
}
