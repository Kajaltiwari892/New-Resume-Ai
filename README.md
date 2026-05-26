# ResumeIQ - AI Resume Analyzer

ResumeIQ is a full-stack AI resume analysis platform that helps job seekers improve their resumes, check ATS readiness, find weak lines, generate stronger rewrites, and prepare for interviews from one focused dashboard.

Live project: [https://new-resume-ai.vercel.app/](https://new-resume-ai.vercel.app/)

## About

ResumeIQ lets users create an account, complete a short career profile, upload or paste a resume, and receive AI-powered feedback. The app scores resumes across hiring-focused dimensions such as ATS keywords, impact, action verbs, formatting, leadership signals, bullet quality, summary strength, and project quality.

The platform is designed for candidates who want practical resume improvements instead of generic advice. It highlights resume issues, suggests better wording, generates interview questions based on the resume, and supports PDF export after editing.

## Features

- User authentication with register, login, refresh token, logout, password reset, and change password flows.
- Onboarding profile for career goals, target role, industry, experience level, dream companies, and resume priorities.
- Resume upload support for PDF and DOCX files.
- Resume text paste option for quick analysis.
- Resume validation to reject files that do not look like resumes.
- ATS and resume quality scoring with grade, verdict, dimension breakdown, wins, and top priorities.
- AI-generated resume improvement suggestions.
- Line-level error scanning for grammar, weak verbs, missing metrics, passive voice, buzzwords, and formatting issues.
- Suggested rewrites for individual resume errors.
- Interview question generation by resume content and target role.
- Keyword matching against job descriptions.
- Resume PDF export with template, font, accent color, and AI summary options.
- Secure backend with JWT auth, refresh token rotation, rate limiting, Helmet, CORS, HPP, and Mongo sanitization.

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI / shadcn-style components
- Motion
- Lucide React and React Icons
- Three.js / OGL visual effects

### Backend

- Node.js
- Express
- MongoDB with Mongoose
- JWT authentication
- bcrypt password hashing
- multer file uploads
- pdf-parse and mammoth for resume parsing
- PDFKit for PDF export
- Gemini API for AI analysis, with heuristic fallbacks

## Project Structure

```text
.
|-- app/                    # Next.js app routes
|-- components/             # UI and ResumeIQ feature components
|-- lib/                    # Frontend API clients and utilities
|-- public/                 # Static assets
|-- server/                 # Express API server
|   |-- src/config/         # Environment and database config
|   |-- src/controllers/    # Auth, onboarding, and resume controllers
|   |-- src/middleware/     # Auth, validation, upload, security helpers
|   |-- src/models/         # Mongoose models
|   |-- src/routes/         # API route definitions
|   |-- src/services/       # AI, parsing, PDF, and resume validation services
|   `-- src/utils/          # Shared backend utilities
`-- types/                  # Local TypeScript declarations
```

## Getting Started

### Prerequisites

- Node.js 20 or later recommended
- npm
- MongoDB connection string
- Gemini API key, optional but recommended for AI-powered results

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Install Backend Dependencies

```bash
cd server
npm install
```

### 3. Configure Environment Variables

Create `server/.env`:

```env
NODE_ENV=development
PORT=4000
CLIENT_ORIGIN=http://localhost:3000

MONGODB_URI=your_mongodb_connection_string

JWT_ACCESS_SECRET=your_long_access_secret
JWT_REFRESH_SECRET=your_different_long_refresh_secret
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

COOKIE_SECURE=false
COOKIE_SAMESITE=lax

BCRYPT_ROUNDS=12
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCK_MINUTES=15
UPLOAD_MAX_MB=5

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_AUTH_API_URL=http://localhost:4000
```

Generate strong JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Run the command twice and use different values for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

### 4. Run the Backend

```bash
cd server
npm run dev
```

The API runs on [http://localhost:4000](http://localhost:4000).

### 5. Run the Frontend

In a second terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

### Frontend

```bash
npm run dev      # Start Next.js development server
npm run build    # Build production frontend
npm run start    # Start production frontend
npm run lint     # Run ESLint
```

### Backend

```bash
cd server
npm run dev      # Start Express server with node --watch
npm run build    # Syntax-check backend entry file
npm run start    # Start Express server
```

## API Overview

Base URL in development: `http://localhost:4000`

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | API health check |
| POST | `/api/auth/register` | Create a new user |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password |
| POST | `/api/auth/change-password` | Change password |
| GET | `/api/onboarding` | Get onboarding profile |
| PUT | `/api/onboarding` | Save onboarding profile |
| GET | `/api/resumes` | List resumes |
| POST | `/api/resumes` | Create resume from pasted text |
| POST | `/api/resumes/upload` | Upload PDF or DOCX resume |
| GET | `/api/resumes/:id` | Get resume |
| PATCH | `/api/resumes/:id` | Update resume sections |
| DELETE | `/api/resumes/:id` | Delete resume |
| POST | `/api/resumes/:id/analyze` | Analyze resume |
| GET | `/api/resumes/:id/analysis` | Get latest analysis |
| POST | `/api/resumes/:id/suggestions` | Generate suggestions |
| GET | `/api/resumes/:id/suggestions` | List suggestions |
| POST | `/api/resumes/:id/errors` | Scan line-level errors |
| GET | `/api/resumes/:id/errors` | List errors |
| POST | `/api/resumes/:id/interview` | Generate interview questions |
| POST | `/api/resumes/:id/keywords` | Match resume with job description |
| GET | `/api/resumes/:id/export` | Export resume as PDF |

## Deployment

This project is deployed with:

- Frontend: Vercel
- Backend: Render

Production frontend:

[https://new-resume-ai.vercel.app/](https://new-resume-ai.vercel.app/)

For production deployment, set the frontend environment variable to the deployed Render API URL:

```env
NEXT_PUBLIC_AUTH_API_URL=https://your-render-api-url
```

On Render, set the backend environment variables from the `server/.env` section and make sure `CLIENT_ORIGIN` includes the Vercel URL:

```env
CLIENT_ORIGIN=https://new-resume-ai.vercel.app
COOKIE_SECURE=true
COOKIE_SAMESITE=none
```

## Security Notes

- Refresh tokens are stored in HTTP-only cookies.
- Access tokens are kept client-side for short-lived authenticated requests.
- Refresh tokens are rotated and stored hashed on the server.
- Auth and AI endpoints use rate limiting.
- CORS is restricted to configured client origins.
- Uploaded resume size is limited by `UPLOAD_MAX_MB`.
- Mongo query sanitization, HPP protection, Helmet headers, and JSON body limits are enabled.

## Author

Built and deployed as a full-stack AI resume platform using Next.js, Express, MongoDB, and Gemini-powered resume intelligence.
