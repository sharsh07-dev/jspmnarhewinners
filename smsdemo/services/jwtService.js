import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export function generateJwtToken(payload) {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn
  });
}
