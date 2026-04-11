import nodemailer from 'nodemailer';
import { config } from './index.js';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // Use SSL
  auth: {
    user: config.email.username,
    pass: config.email.password
  }
});

export default transporter;


