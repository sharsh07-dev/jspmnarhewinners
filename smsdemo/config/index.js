import dotenv from 'dotenv';
import Joi from 'joi';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../.env') });

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  EMAIL_SERVICE: Joi.string().default('gmail'),
  EMAIL_USERNAME: Joi.string().email().required(),
  EMAIL_PASSWORD: Joi.string().required(),
  EMAIL_FROM: Joi.string().required(),
  REDIS_URL: Joi.string().optional().allow(''),
  OTP_EXPIRATION_MINUTES: Joi.number().integer().min(1).default(5),
  OTP_REQUEST_INTERVAL_SECONDS: Joi.number().integer().min(5).default(30),
  OTP_MAX_ATTEMPTS: Joi.number().integer().min(1).default(3),
  OTP_HASH_SECRET: Joi.string().min(32).default(Joi.ref('JWT_SECRET'))
}).unknown();

const { value: env, error } = envSchema.validate(process.env, { abortEarly: false });

if (error) {
  console.error('Environment validation error:', error.message);
  process.exit(1);
}

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,
  email: {
    service: env.EMAIL_SERVICE,
    username: env.EMAIL_USERNAME,
    password: env.EMAIL_PASSWORD,
    from: env.EMAIL_FROM
  },
  redisUrl: env.REDIS_URL,
  otp: {
    expirationMinutes: env.OTP_EXPIRATION_MINUTES,
    requestIntervalSeconds: env.OTP_REQUEST_INTERVAL_SECONDS,
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    hashSecret: env.OTP_HASH_SECRET
  }
};
