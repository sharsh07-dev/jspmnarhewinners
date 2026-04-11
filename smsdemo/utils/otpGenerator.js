import crypto from 'crypto';

export function createSecureOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

export function hashOtp(otp, secret) {
  return crypto.createHmac('sha256', secret).update(otp).digest('hex');
}

export function safeCompare(valueA, valueB) {
  const bufferA = Buffer.from(valueA, 'utf-8');
  const bufferB = Buffer.from(valueB, 'utf-8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
}
