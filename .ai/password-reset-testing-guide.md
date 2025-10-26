# Password Reset Flow Testing Guide

## Overview
This document describes how to test the OTP-based password reset flow.

## Prerequisites
- Supabase local dev running: `npx supabase start`
- Astro dev server running: `npm run dev`
- Mailpit UI accessible at: http://127.0.0.1:54324

## Complete Flow Test

### Step 1: Request OTP Code

**UI Test:**
1. Navigate to http://localhost:4321/auth/forgot-password
2. Enter your email address (e.g., test@example.com)
3. Click "Wyślij kod weryfikacyjny"
4. You should see a success message with email notification

**API Test:**
```bash
curl -X POST "http://localhost:4321/api/v1/auth/password/request-reset" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Jeśli podany adres e-mail istnieje, wysłaliśmy kod weryfikacyjny (6 cyfr)"
}
```

### Step 2: Check Email for OTP Code

**Local Development:**
1. Open Mailpit UI: http://127.0.0.1:54324
2. Find the latest email sent to your test email
3. Look for a 6-digit code in the email body
4. **IMPORTANT:** The code expires in 60 seconds!

**Email Example:**
```
Your code is: 123456

This code will expire in 60 seconds.
```

### Step 3: Verify OTP and Reset Password

**UI Test:**
1. After submitting email, you'll see the OTP form automatically
2. Enter the 6-digit OTP code from email
3. Enter new password (min 8 characters)
4. Confirm new password
5. Click "Ustaw nowe hasło"
6. You should be redirected to login page

**API Test:**
```bash
# Replace 123456 with your actual OTP code
curl -X POST "http://localhost:4321/api/v1/auth/password/verify-and-reset" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "otp":"123456",
    "newPassword":"NewPassword123",
    "confirmNewPassword":"NewPassword123"
  }'
```

**Expected Response:**
```json
{
  "status": "ok",
  "message": "Hasło zostało zmienione pomyślnie"
}
```

### Step 4: Login with New Password

**UI Test:**
1. Navigate to http://localhost:4321/auth/login
2. Enter your email
3. Enter the NEW password
4. Click "Zaloguj się"
5. You should be redirected to /decks

**API Test:**
```bash
curl -i -X POST "http://localhost:4321/api/v1/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"NewPassword123"
  }'
```

**Expected Response:**
- HTTP Status: 303 (redirect)
- Location header: /decks
- Set-Cookie headers with session tokens

## Error Scenarios

### Invalid Email Format
```bash
curl -X POST "http://localhost:4321/api/v1/auth/password/request-reset" \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email"}'
```

**Expected:** 400 Bad Request with validation error

### Invalid OTP Code
```bash
curl -X POST "http://localhost:4321/api/v1/auth/password/verify-and-reset" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "otp":"000000",
    "newPassword":"NewPassword123",
    "confirmNewPassword":"NewPassword123"
  }'
```

**Expected:** 400 Bad Request with "Nieprawidłowy lub wygasły kod weryfikacyjny"

### Expired OTP Code
Wait more than 60 seconds after receiving OTP, then try to verify.

**Expected:** 400 Bad Request with "Nieprawidłowy lub wygasły kod weryfikacyjny"

### Password Mismatch
```bash
curl -X POST "http://localhost:4321/api/v1/auth/password/verify-and-reset" \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "otp":"123456",
    "newPassword":"NewPassword123",
    "confirmNewPassword":"DifferentPassword123"
  }'
```

**Expected:** 400 Bad Request with validation error "Hasła nie są identyczne"

### Rate Limiting
Make 4+ requests within 1 minute with the same email.

**Expected:** 429 Too Many Requests on the 4th request

```json
{
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many password reset attempts. Please try again later.",
    "details": "Retry after 60 seconds"
  }
}
```

## Security Features

### ✅ Neutral Messaging
- Always returns success for email step (doesn't reveal if email exists)
- Security best practice to prevent email enumeration

### ✅ Rate Limiting
- Max 3 requests per minute per email
- Prevents brute force and spam

### ✅ OTP Security
- 6-digit code (1 million combinations)
- Expires in 60 seconds
- One-time use only

### ✅ Password Requirements
- Minimum 8 characters
- Validated both client and server side

## Automated Test Script

Run the automated test:
```bash
bash test-password-reset-otp.sh
```

This will:
1. Request OTP for test email
2. Show instructions to check Mailpit
3. Provide manual steps to complete the flow

## Mailpit (Local Email Testing)

**Access:** http://127.0.0.1:54324

**Features:**
- View all emails sent by Supabase
- See OTP codes in real-time
- No actual email delivery needed for testing

**Finding OTP Codes:**
1. Open Mailpit UI
2. Click on the latest email
3. Look in the email body for the 6-digit code
4. Copy and use within 60 seconds

## Production Considerations

### Email Configuration
For production, configure proper SMTP in Supabase Dashboard:
- Navigate to: Authentication > Settings > SMTP Settings
- Add SMTP provider (SendGrid, AWS SES, Mailgun, etc.)
- Configure SPF/DKIM for domain

### Email Template Customization
Default Supabase OTP template is used. To customize:
1. Go to: Authentication > Email Templates > Magic Link
2. Edit the template with your branding
3. Keep `{{ .Token }}` placeholder for OTP code

### Rate Limiting
Current implementation uses in-memory storage (OK for MVP).
For production:
- Consider Redis for distributed rate limiting
- Adjust limits based on actual usage patterns

## Troubleshooting

### OTP Not Received
- Check Mailpit UI: http://127.0.0.1:54324
- Verify Supabase is running: `npx supabase status`
- Check console for errors

### OTP Expired
- OTP codes expire in 60 seconds
- Request a new code if expired
- Use "Wyślij ponownie" button in UI

### Password Not Updating
- Verify OTP was successfully verified (check response)
- Check browser console for errors
- Verify new password meets requirements (8+ chars)

### Rate Limit Hit
- Wait 60 seconds before trying again
- Check if you're testing with correct email
- Rate limit is per email address

## Success Criteria (from PRD US-014)

- [x] User can request password reset from login page
- [x] Neutral success message shown (security)
- [x] OTP code sent via email (6 digits)
- [x] Code expires in 60 seconds
- [x] User can enter OTP + new password
- [x] Password successfully updated
- [x] User can login with new password
- [x] Rate limiting prevents abuse (3/min per email)
- [x] Client-side validation (email, OTP format, password length)
- [x] Server-side validation (Zod schemas)
- [x] Error messages are user-friendly

## API Endpoints

### POST /api/v1/auth/password/request-reset
Request OTP code via email

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:** 200 OK (always for security)

### POST /api/v1/auth/password/verify-and-reset
Verify OTP and update password

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "newPassword": "NewPassword123",
  "confirmNewPassword": "NewPassword123"
}
```

**Response:** 200 OK on success, 400 on invalid OTP/validation error
