# ResumeIQ Auth Server

Standalone Express + MongoDB auth service.

## Setup

```bash
cd server
npm install
cp .env.example .env
# Fill in MONGODB_URI and the two JWT secrets in .env
npm run dev
```

The server listens on `http://localhost:4000` by default. The Next.js frontend
is expected at `http://localhost:3000` (see `CLIENT_ORIGIN`).

## Endpoints

| Method | Path                              | Purpose                                    |
| ------ | --------------------------------- | ------------------------------------------ |
| POST   | `/api/auth/register`              | Create account                             |
| POST   | `/api/auth/login`                 | Email + password login                     |
| POST   | `/api/auth/refresh`               | Rotate access token from refresh cookie    |
| POST   | `/api/auth/logout`                | Invalidate refresh token, clear cookies    |
| GET    | `/api/auth/me`                    | Current user (access token required)       |
| POST   | `/api/auth/forgot-password`       | Issue password reset token (always 200)    |
| POST   | `/api/auth/reset-password`        | Consume reset token, set new password      |
| POST   | `/api/auth/change-password`       | Change password while logged in            |
| GET    | `/health`                         | Liveness                                   |

## Security

- bcrypt (configurable cost)
- JWT access (short-lived) + refresh (long-lived, hashed server-side) with rotation
- httpOnly, sameSite, signed cookies for the refresh token
- Per-IP + per-account rate limits, progressive lockout on failed logins
- Helmet, HPP, `express-mongo-sanitize`, JSON body size cap
- Strict CORS allowlist (single origin)
- No user enumeration on register/login/forgot-password response shapes
- Password strength + normalization (trim, lowercase email)
- Refresh tokens are one-time: used tokens are revoked on refresh (rotation)

## Generating secrets

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run it twice — once for `JWT_ACCESS_SECRET`, once for `JWT_REFRESH_SECRET`.
