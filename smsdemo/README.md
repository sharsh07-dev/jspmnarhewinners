# Email OTP Authentication Service

Production-ready Email OTP Authentication API built with Node.js, Express, Nodemailer, and JWT.

## Features

- Secure 6-digit OTP generation
- Gmail SMTP email delivery
- Redis-backed OTP storage with in-memory fallback
- Rate limiting per email for OTP requests
- OTP expiry and attempt limits
- Centralized validation and error handling
- JWT token issuance after OTP verification

## Project Structure

- `server.js`
- `config/` - environment and mail configuration
- `controllers/` - request handlers
- `routes/` - Express routes
- `services/` - OTP, email, JWT, persistence
- `utils/` - helpers, templates, validation
- `middlewares/` - validation, error handling, rate limiting

## Setup

1. Install dependencies

```bash
npm install
```

2. Copy `.env.example` to `.env` and fill secrets

```bash
cp .env.example .env
```

3. Start the app

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

### POST /auth/send-otp

Request body:

```json
{
  "email": "user@example.com"
}
```

### POST /auth/verify-otp

Request body:

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

## Notes

- Use a Gmail App Password for `EMAIL_PASSWORD` when 2FA is enabled.
- Redis support is optional; if `REDIS_URL` is not provided, the service falls back to in-memory storage.
