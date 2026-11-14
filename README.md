# Standalone & Reusable Authentication & Authorization Module

A production-ready, self-contained, and modular Authentication & Authorization system built with **Node.js**, **Express**, **TypeScript**, and **TypeORM** (PostgreSQL).

This module is designed to run either as an independent microservice / backend server or to be copied directly into existing or new backend projects as a plug-and-play authentication engine.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Architecture & Folder Structure](#architecture--folder-structure)
3. [Environment Configuration](#environment-configuration)
4. [Standalone Quick Start](#standalone-quick-start)
5. [Integration into Other Projects](#integration-into-other-projects)
6. [API Reference](#api-reference)
   - [Authentication Endpoints (`/api/v1/auth`)](#authentication-endpoints-apiv1auth)
   - [User & Profile Endpoints (`/api/v1/users`)](#user--profile-endpoints-apiv1users)
7. [Security & Rate Limiting](#security--rate-limiting)
8. [Testing & Verification](#testing--verification)

---

## Key Features

- **Local Authentication**: Email / Phone & Password registration and login with bcrypt hashing.
- **Multi-Channel OTP Verification**:
  - Email OTP via **Nodemailer** (HTML templates for registration, password reset, and verification).
  - SMS OTP via **SMSHub** and **EthioSMS** gateways.
  - Multi-purpose support (`REGISTRATION`, `PASSWORD_RESET`, `LOGIN`, `PHONE_VERIFICATION`).
  - Brute-force protection: attempts counting, expiration timestamps, and one-time consumption.
- **Google OAuth2 Sign-In**:
  - Secure verification using `google-auth-library`.
  - Deterministic account identity binding (`AuthIdentity` linked by Google `sub` ID).
  - Explicit conflict resolution: prevents silent hijacking/auto-merging of existing accounts while offering explicit password-verified account linking.
- **Role-Based Access Control (RBAC) & Status Guards**:
  - Standard roles (`user`, `company_admin`, `super_admin`).
  - Account lifecycle states (`ACTIVE`, `PENDING_VERIFICATION`, `SUSPENDED`).
  - JWT generation and payload verification with status enforcement.
- **Rate Limiting & Anti-Brute-Force**:
  - IP and identifier-based rate limiting on sensitive routes (`/login`, `/register`, `/otp/send`, `/otp/verify`, `/forgot-password`).
  - Non-blocking cleanup intervals (using `.unref()`) to prevent lingering Node.js process loops.
- **Profile & File Uploads**:
  - Profile retrieval (`/auth/me`), avatar photo upload (Multer with strict MIME and size checks), profile updates, and account deletion.
- **Database & Migrations**:
  - Clean TypeORM schema completely decoupled from non-auth business domains (such as events, blogs, or payments).
  - Ready-to-use TypeORM migration script for reproducible database provisioning.

---

## Architecture & Folder Structure

```text
authentication/
├── .env.example               # Template for environment variables
├── .gitignore                  # Git ignore rules
├── nodemon.json                # Nodemon configuration for development
├── package.json                # Project dependencies and script shortcuts
├── tsconfig.json               # TypeScript compiler configuration
├── README.md                   # Complete module documentation
└── src/
    ├── app.ts                  # Express application setup and standalone HTTP server
    ├── index.ts                # Main module entry point (exports entities, services, routes, middlewares)
    ├── config/
    │   ├── auth.config.ts      # Auth configuration loader & validation
    │   └── data-source.ts      # TypeORM DataSource configuration
    ├── controllers/
    │   ├── auth.controller.ts  # Auth route handlers (register, login, google, otp, password reset)
    │   └── user.controller.ts  # User profile handlers (profile, upload avatar, update, delete)
    ├── entities/
    │   ├── User.ts             # Primary user entity (demographics, status, role, avatar)
    │   ├── LocalCredential.ts  # Local password credentials (1:1 with User)
    │   ├── AuthIdentity.ts     # Third-party federated identities (Google, OAuth)
    │   ├── PasswordResetToken.ts # Password reset tokens & expiration
    │   ├── otp-verification.ts # OTP verification codes, channels, and attempts
    │   └── index.ts            # Central entity exports
    ├── enums/
    │   ├── otp-purpose.enum.ts
    │   ├── user-role.enum.ts
    │   ├── user-status.enum.ts
    │   ├── verification-status.enum.ts
    │   └── index.ts
    ├── middlewares/
    │   ├── auth.middleware.ts                 # JWT verification and role authorization guards
    │   ├── error.middleware.ts                # Centralized error handler and payload formatter
    │   ├── forgot-password-rate-limit.middleware.ts # Forgot-password throttle
    │   ├── login-rate-limit.middleware.ts     # Login brute-force limiter
    │   ├── otp-rate-limit.middleware.ts       # OTP rate limiter
    │   ├── rate-limit.middleware.ts           # General route rate limiter
    │   └── user-upload.middleware.ts          # Multer avatar upload handler
    ├── migrations/
    │   └── 1710000000000-CreateAuthSchema.ts  # Production TypeORM migration for auth tables
    ├── modules/
    │   ├── ethiosms/           # EthioSMS HTTP API client and sender
    │   └── sms/                # SMSHub HTTP API client and sender
    ├── routes/
    │   ├── auth.routes.ts      # Authentication endpoints
    │   ├── user.routes.ts      # User profile endpoints
    │   └── index.ts            # Combined Express router
    ├── services/
    │   ├── auth.service.ts     # Authentication business logic & workflows
    │   ├── email.service.ts    # Nodemailer email transport & dispatch
    │   ├── emailtemplates.ts   # HTML email templates
    │   ├── google-auth.service.ts # Google OAuth token verification and account resolution
    │   ├── otp.service.ts      # OTP code generation, dispatch, verification, and rate checking
    │   ├── user.service.ts     # User CRUD operations
    │   └── index.ts
    ├── tests/
    │   ├── ethiosms-sender.test.ts # EthioSMS client unit test
    │   ├── google-auth.test.ts     # Google OAuth handler unit test
    │   ├── jwt-auth-status.test.ts # JWT token & account status unit test
    │   └── otp-verification.test.ts # OTP lifecycle and verification unit test
    ├── utils/
    │   ├── jwt.utils.ts        # JWT generation & decoding utilities
    │   ├── password.utils.ts   # Bcrypt hash and comparison helpers
    │   ├── response.utils.ts   # Standardized API response formatters
    │   ├── upload.utils.ts     # File storage and upload path utilities
    │   ├── user-columns.utils.ts # Sanitized TypeORM select columns for User queries
    │   └── user-details.util.ts  # Public user serialization utility
    └── validators/
        ├── auth.dto.ts         # Register, Login, GoogleAuth, ResetPassword DTOs (class-validator)
        ├── otp.dto.ts          # SendOtp, VerifyOtp DTOs
        ├── user.dto.ts         # UpdateUser DTO
        └── index.ts
```

---

## Environment Configuration

Create a `.env` file in the root directory (or copy `.env.example`):

```bash
cp .env.example .env
```

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `PORT` | HTTP Server port | `5000` |
| `NODE_ENV` | Environment mode (`development` / `production`) | `development` |
| `DB_HOST` | PostgreSQL Host | `localhost` |
| `DB_PORT` | PostgreSQL Port | `5432` |
| `DB_USERNAME` | Database username | `postgres` |
| `DB_PASSWORD` | Database password | `postgres` |
| `DB_DATABASE` | Database name | `auth_db` |
| `DB_SSL` | Enable SSL for database connections | `false` |
| `JWT_SECRET` | Secret key used to sign JWTs | `your-secure-jwt-secret-here` |
| `JWT_EXPIRY` | Token expiration lifespan | `7d` |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Web Client ID | `your-google-client-id.apps.googleusercontent.com` |
| `EMAIL_SERVICE` | Nodemailer service provider | `gmail` |
| `EMAIL_USER` | Email address for sending OTPs | `notifications@example.com` |
| `EMAIL_PASS` | SMTP app password | `app-specific-password` |
| `EMAIL_FROM` | Default "From" header | `No Reply <notifications@example.com>` |
| `SMSHUB_API_KEY` | SMSHub gateway API Key | `your-smshub-api-key` |
| `ETHIOSMS_API_KEY` | EthioSMS gateway API Key | `your-ethiosms-api-key` |
| `ETHIOSMS_SENDER_ID` | EthioSMS approved Sender ID | `MYAPP` |

---

## Standalone Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Migrations**:
   ```bash
   npm run migration:run
   ```

3. **Start Development Server** (hot reload via nodemon):
   ```bash
   npm run dev
   ```

4. **Build & Run Production**:
   ```bash
   npm run build
   npm start
   ```

---

## Integration into Other Projects

To reuse this module in an existing Express + TypeORM project:

### 1. Copy the folder
Copy the `authentication/src` folder (or relevant parts) into your backend directory, e.g., `src/modules/auth` or `src/authentication`.

### 2. Include Entities in Your TypeORM Data Source
Import the entities and include them in your TypeORM `DataSource`:

```typescript
import { DataSource } from 'typeorm';
import {
  User,
  LocalCredential,
  AuthIdentity,
  PasswordResetToken,
  OtpVerification
} from './authentication/src/entities';

export const AppDataSource = new DataSource({
  type: 'postgres',
  // ... database connection details ...
  entities: [
    User,
    LocalCredential,
    AuthIdentity,
    PasswordResetToken,
    OtpVerification,
    // ... your other entities ...
  ],
  migrations: [
    // ... include authentication/src/migrations/1710000000000-CreateAuthSchema.ts
  ]
});
```

### 3. Mount Routes in Your Express App
Import and mount the unified authentication router:

```typescript
import express from 'express';
import { authModuleRoutes } from './authentication/src';

const app = express();
app.use(express.json());

// Mount all authentication and user profile routes
app.use('/api/v1', authModuleRoutes);
```

### 4. Protect Your Routes with Middleware
Use `requireAuth` and `requireRoles` to protect any route in your application:

```typescript
import { requireAuth, requireRoles } from './authentication/src';
import { UserRole } from './authentication/src/enums';

// Only authenticated users with ACTIVE status
app.get('/api/v1/dashboard', requireAuth, (req, res) => {
  res.json({ message: 'Welcome!', user: req.user });
});

// Admin-only route
app.get('/api/v1/admin/stats', requireAuth, requireRoles(UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN), (req, res) => {
  res.json({ stats: 'Admin statistics' });
});
```

---

## API Reference

All requests and responses use JSON. Authenticated endpoints require the `Authorization` header formatted as:
`Authorization: Bearer <jwt-token>`

### Authentication Endpoints (`/api/v1/auth`)

#### 1. Register User
- **Method**: `POST`
- **Path**: `/api/v1/auth/register`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!",
    "firstName": "John",
    "lastName": "Doe",
    "phoneNumber": "+251911223344"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "status": "success",
    "message": "User registered successfully",
    "data": {
      "user": {
        "id": "c1f7b9c2-...",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "phoneNumber": "+251911223344",
        "role": "user",
        "status": "active"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

#### 2. Login
- **Method**: `POST`
- **Path**: `/api/v1/auth/login`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "Login successful",
    "data": {
      "user": { ... },
      "token": "eyJhbGciOi..."
    }
  }
  ```

#### 3. Google Sign-In
- **Method**: `POST`
- **Path**: `/api/v1/auth/google`
- **Body**:
  ```json
  {
    "idToken": "eyJhbGciOi..."
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "Google authentication successful",
    "data": {
      "user": { ... },
      "token": "eyJhbGciOi..."
    }
  }
  ```
- **Conflict Handling (`409 Conflict`)**:
  If an account exists with the same email via local credentials, the API returns a `409 Conflict` with `conflict: true`. To safely merge the Google identity with the local account, submit:
  ```json
  {
    "idToken": "eyJhbGciOi...",
    "linkPassword": "UserExistingLocalPassword"
  }
  ```

#### 4. Send OTP
- **Method**: `POST`
- **Path**: `/api/v1/auth/otp/send`
- **Body**:
  ```json
  {
    "identifier": "+251911223344",
    "channel": "sms",
    "purpose": "registration"
  }
  ```
  *(or `channel: "email"` with an email identifier)*
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "OTP sent successfully",
    "data": {
      "identifier": "+251911223344",
      "channel": "sms",
      "purpose": "registration",
      "expiresInSeconds": 300
    }
  }
  ```

#### 5. Verify OTP
- **Method**: `POST`
- **Path**: `/api/v1/auth/otp/verify`
- **Body**:
  ```json
  {
    "identifier": "+251911223344",
    "code": "123456",
    "purpose": "registration"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "OTP verified successfully",
    "data": {
      "verified": true,
      "purpose": "registration"
    }
  }
  ```

#### 6. Forgot Password
- **Method**: `POST`
- **Path**: `/api/v1/auth/forgot-password`
- **Body**:
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "message": "If this email is registered, you will receive password reset instructions"
  }
  ```

#### 7. Reset Password
- **Method**: `POST`
- **Path**: `/api/v1/auth/reset-password`
- **Body**:
  ```json
  {
    "token": "reset-token-received-in-email",
    "newPassword": "NewStrongPassword123!"
  }
  ```

#### 8. Get Current Authenticated Profile
- **Method**: `GET`
- **Path**: `/api/v1/auth/me`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`):
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "c1f7b9c2-...",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe",
        "role": "user",
        "status": "active"
      }
    }
  }
  ```

---

### User & Profile Endpoints (`/api/v1/users`)

| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/users` | Yes (`super_admin`, `company_admin`) | List all users (paginated) |
| `GET` | `/api/v1/users/:id` | Yes | Get user by ID |
| `PUT` | `/api/v1/users/:id` | Yes (Self or Admin) | Update user profile fields |
| `POST` | `/api/v1/users/:id/avatar` | Yes (Self or Admin) | Upload profile picture (`multipart/form-data`, field: `avatar`) |
| `DELETE` | `/api/v1/users/:id` | Yes (Self or Admin) | Delete user account |

---

## Security & Rate Limiting

1. **Password Security**:
   - Salted and hashed using `bcryptjs` with configurable rounds.
   - Plaintext passwords are never stored or returned in any API response.
2. **Account Linking Defense**:
   - Google Sign-In requires explicit verification before binding to an existing email to protect against pre-account takeover attacks.
3. **Suspended & Pending Account Guard**:
   - The auth middleware validates user existence and active status in the database on protected routes, revoking access immediately if the user is suspended or deactivated.
4. **Rate Limit Throttling**:
   - Dedicated memory caches limit brute force login attempts (`5 attempts per 15 min`).
   - OTP spam limit (`1 request per minute per identifier`).
   - Forgot-password throttle (`3 requests per hour per email`).

---

## Testing & Verification

The module includes comprehensive unit and integration test scripts located in `src/tests/`:

- **Run JWT & Account Status Guard Tests**:
  ```bash
  npm run test:auth
  ```
- **Run Google OAuth & Account Linking Tests**:
  ```bash
  npm run test:google-auth
  ```
- **Run OTP Lifecycle & Verification Tests**:
  ```bash
  npm run test:otp
  ```
- **Run EthioSMS Gateway Tests**:
  ```bash
  npm run test:ethiosms
  ```
