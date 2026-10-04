# PJ-A Backend — Ticket Selling + Booking + Customer Support

NestJS backend for ticket selling platform. 

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Setup](#3-setup)
4. [Architecture](#4-architecture)
5. [API Endpoints](#5-api-endpoints)
6. [Full Test Flow](#6-full-test-flow)
7. [Database](#7-database)
8. [Redis Keys](#8-redis-keys)
9. [Branch Strategy](#9-branch-strategy)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 10 |
| Language | TypeScript |
| Primary DB | MongoDB (Mongoose) |
| Cache/Session | Redis (ioredis) |
| Auth | JWT (access + refresh) + argon2 |
| Logger | Winston + AsyncLocalStorage |
| Health | @nestjs/terminus |
| Runtime | Node.js 20 |

---

## 2. Project Structure

```
backend/
├── src/
│   ├── main.ts                    # Bootstrap + global pipes/interceptors
│   ├── app.module.ts              # Root module + global guard
│   │
│   ├── common/                    # Cross-cutting concerns
│   │   ├── middleware/
│   │   │   └── request-id.middleware.ts
│   │   ├── filters/
│   │   │   └── all-exceptions.filter.ts
│   │   ├── interceptors/
│   │   │   └── response.interceptor.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts
│   │   ├── decorators/
│   │   │   ├── public.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── skip-wrap.decorator.ts
│   │   ├── dto/
│   │   │   ├── api-error.dto.ts
│   │   │   └── api-success.dto.ts
│   │   ├── logger/
│   │   │   ├── logger.service.ts
│   │   │   ├── logger.module.ts
│   │   │   └── request-context.ts
│   │   ├── security/
│   │   │   └── password.service.ts
│   │   └── shared/
│   │       ├── services/pagination.service.ts
│   │       ├── services/id.service.ts
│   │       └── shared.module.ts
│   │
│   ├── infra/
│   │   └── redis/
│   │       ├── redis.service.ts
│   │       ├── redis.module.ts
│   │       └── redis.constants.ts
│   │
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── dto/ (register, login, refresh, logout)
│   │   └── interfaces/ (jwt-payload, token-pair)
│   │
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── schemas/user.schema.ts
│   │   └── dto/ (create-user, update-profile)
│   │
│   ├── roles/
│   │   ├── roles.module.ts
│   │   └── schemas/role.schema.ts
│   │
│   ├── permissions/
│   │   ├── permissions.module.ts
│   │   └── schemas/permission.schema.ts
│   │
│   └── health/
│       ├── health.module.ts
│       └── health.controller.ts
│
├── .env
├── .env.example
├── docker-compose.yml
├── package.json
└── README.md
```

---

## 3. Setup

### 3.1 Prerequisites

- Node.js 20+
- Docker (for MongoDB + Redis)
- npm

### 3.2 Install

```bash
git clone <repo-url>
cd backend
npm install
```

### 3.3 Environment (`.env`)

```env
# ─── App ───
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# ─── MongoDB ───
MONGO_URI=mongodb://admin:admin123@localhost:27017/my_database?authSource=admin

# ─── Redis ───
REDIS_URL=redis://localhost:6379

# ─── JWT ───
JWT_ACCESS_SECRET=change-me-access-secret-min-32-characters-long
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-characters-long
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

**Secret ဖန်တီးရန်:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3.4 Start Dependencies

```bash
# MongoDB
docker run -d --name dev-mongo -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=admin123 \
  mongo:7

# Redis
docker run -d --name dev-redis -p 6379:6379 redis:7-alpine
```

### 3.5 Run

```bash
# Dev (hot reload)
npm run start:dev

# Prod build
npm run build
npm run start:prod
```

Server: http://localhost:3000

---

## 4. Architecture

### 4.1 Request Lifecycle

```
Client
  │
  ▼
[1] RequestIdMiddleware    → x-request-id header ထည့်
  │
  ▼
[2] JwtAuthGuard (global)  → @Public() မရှိရင် token verify
  │
  ▼
[3] Interceptors (before)
  │
  ▼
[4] ValidationPipe         → DTO validate
  │
  ▼
[5] Controller             → route handle
  │
  ▼
[6] Service                → business logic
  │
  ▼
[7] MongoDB / Redis
  │
  ▼
[8] ResponseInterceptor    → { success, data, meta, requestId, timestamp }
  │
  ▼
[9] ExceptionFilter        → error ဖြစ်ရင် { success: false, error, ... }
  │
  ▼
Client
```

### 4.2 Standard Response

**Success:**
```json
{
  "success": true,
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100 },
  "requestId": "uuid",
  "timestamp": "2026-10-01T..."
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": []
  },
  "requestId": "uuid",
  "path": "/api/path",
  "timestamp": "2026-10-01T..."
}
```

### 4.3 Modules

| Module | Type | ဘာလုပ်လဲ |
|---|---|---|
| `LoggerModule` | Global | Winston logger + AsyncLocalStorage |
| `SharedModule` | Global | Pagination + ID generator |
| `SecurityModule` | Global | Password hashing (argon2) |
| `RedisModule` | Global | Redis service |
| `AuthModule` | Feature | Register/Login/Refresh/Logout |
| `UsersModule` | Feature | User CRUD + profile |
| `RolesModule` | Feature | Role (RBAC, PJ-04) |
| `PermissionsModule` | Feature | Permission list (PJ-04) |
| `HealthModule` | Feature | Health check |

---

## 5. API Endpoints

Base URL: `http://localhost:3000`

### 5.1 Health (Public)

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Full health (MongoDB ping) |
| GET | `/health/live` | Liveness (process only) |
| GET | `/health/ready` | Readiness (DB) |

**Example:**
```bash
curl -s http://localhost:3000/health | jq
```

```json
{
  "status": "ok",
  "info": { "mongodb": { "status": "up", "responseTime": 4 } },
  "error": {},
  "details": { "mongodb": { "status": "up", "responseTime": 4 } }
}
```

### 5.2 Auth (Public)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | User အသစ် |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Access token အသစ် |
| POST | `/auth/logout` | Single session logout |

### 5.3 Auth (Protected)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/logout-all` | Session အားလုံး ဖျက် |

### 5.4 Users

| Method | Path | Protected | Description |
|---|---|---|---|
| POST | `/users` | Yes | User create (admin, PJ-04) |
| GET | `/users/me` | Yes | Current user profile |
| PATCH | `/users/me` | Yes | Update profile |
| GET | `/users` | Yes | List (paginated, admin, PJ-04) |

---

## 6. Full Test Flow

**⚠️ အရေးကြီး — အစဉ်လိုက် လုပ်ပါ။**

### 6.0 Setup

```bash
BASE=http://localhost:3000
EMAIL="test$(date +%s)@example.com"     # unique email
PASSWORD="Passw0rd123"
echo "Testing with: $EMAIL"
```

**`EMAIL` ကို သိမ်းထား — တစ်ခါ ဖန်တီးပြီး ပြန် မဖန်တီးရ။**

### 6.1 Register

```bash
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"fullName\": \"Test User\",
    \"phone\": \"09123456789\"
  }" | jq
```

**Expected (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "test...@example.com",
      "fullName": "Test User",
      "role": "customer",
      "status": "active",
      "emailVerified": false
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "accessExpiresIn": 900,
    "refreshExpiresIn": 604800
  }
}
```

### 6.2 Login

```bash
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }" | jq
```

**Expected (200):** Register ရဲ့ response နဲ့ တူ (token အသစ်)။

### 6.3 Access Token သိမ်း

```bash
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.data.accessToken')

REFRESH=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.data.refreshToken')

echo "Access: ${TOKEN:0:30}..."
echo "Refresh: ${REFRESH:0:30}..."
```

### 6.4 Protected Route (no token) → 401

```bash
curl -s $BASE/users/me | jq
```

**Expected (401):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_TOKEN_MISSING",
    "message": "Authorization token is required"
  }
}
```

### 6.5 Protected Route (with token) → 200

```bash
curl -s $BASE/users/me \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected (200):**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "email": "test...@example.com",
    "fullName": "Test User",
    "phone": "09123456789",
    "role": "customer",
    "provider": "local",
    "emailVerified": false,
    "status": "active"
  }
}
```

**⚠️ `passwordHash` မပါရ။**

### 6.6 Update Profile

```bash
curl -s -X PATCH $BASE/users/me \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Updated Name","phone":"0999999999"}' | jq
```

**Expected (200):** Updated user data။

### 6.7 Refresh (Rotation)

```bash
curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq
```

**Expected (200):** Token pair အသစ်။

**⚠️ `refreshToken` အသစ် — သိမ်း:**
```bash
NEW_REFRESH=$(curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" \
  | jq -r '.data.refreshToken')
```

### 6.8 Reuse Detection

```bash
# Old refresh token ပြန် သုံး
curl -s -X POST $BASE/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refreshToken\":\"$REFRESH\"}" | jq
```

**Expected (401):**
```json
{
  "success": false,
  "error": {
    "code": "AUTH_REFRESH_TOKEN_REUSED",
    "message": "Refresh token has been revoked. Please login again."
  }
}
```

**⚠️ ဒီအဆင့်ပြီးရင် `NEW_REFRESH` လည်း invalid (session အားလုံး ဖျက်)။**  
**→ Login ပြန် လုပ်ရမယ်။**

### 6.9 Logout All

```bash
# Login ပြန်
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.data.accessToken')

curl -s -X POST $BASE/auth/logout-all \
  -H "Authorization: Bearer $TOKEN" | jq
```

**Expected (200):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out from all devices",
    "revoked": 3
  }
}
```

### 6.10 Error Cases

**Invalid email format:**
```bash
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bad","password":"Passw0rd123","fullName":"Test"}' | jq
# 400 + details
```

**Wrong password:**
```bash
curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"WrongPass999\"}" | jq
# 401 AUTH_INVALID_CREDENTIALS
```

**Duplicate email:**
```bash
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"fullName\":\"Test\"}" | jq
# 409 Email already registered
```

**Refresh token နဲ့ API ခေါ်:**
```bash
REFRESH=$(curl -s -X POST $BASE/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | jq -r '.data.refreshToken')

curl -s $BASE/users/me \
  -H "Authorization: Bearer $REFRESH" | jq
# 401 AUTH_INVALID_TOKEN_TYPE
```

**Extra field (whitelist):**
```bash
curl -s -X POST $BASE/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"new$EMAIL\",\"password\":\"$PASSWORD\",\"fullName\":\"Test\",\"isAdmin\":true}" | jq
# 400 property isAdmin should not exist
```

---

## 7. Database

### 7.1 MongoDB Collections

| Collection | PJ | Fields အဓိက |
|---|---|---|
| `users` | 02 | email, passwordHash, fullName, role, status |
| `roles` | 02 | name, permissions[], isSystem |
| `permissions` | 02 | code, resource, action |

**Future collections:** `ticket_products` (PJ-05), `orders` (PJ-06), `payments` (PJ-07), `purchased_tickets` (PJ-08), `support_tickets` + `support_messages` (PJ-09), `attachments` (PJ-11), `notifications` (PJ-12)

### 7.2 User Schema Fields

```text
email           unique, lowercase
passwordHash    argon2 (select: false → default query မှာ exclude)
fullName        required
phone           optional
avatarUrl       optional
role            enum: customer | agent | admin
provider        enum: local | google
providerId      Google sub (optional)
emailVerified   boolean (default false)
status          enum: active | inactive | banned
lastLoginAt     Date
deletedAt       Date (soft delete)
createdAt       auto
updatedAt       auto
```

### 7.3 MongoDB Shell — Data စစ်

```bash
mongosh

use my_database

# Users အားလုံး
db.users.find().pretty()

# Count
db.users.countDocuments()

# PasswordHash စစ်
db.users.findOne({ email: "test@example.com" }, { passwordHash: 1 })
# → $argon2id$v=19$m=65536,t=3,p=1$...

# Indexes စစ်
db.users.getIndexes()
```

---

## 8. Redis Keys

| Pattern | Purpose | TTL |
|---|---|---|
| `session:{userId}:{jti}` | Refresh token session | 7d |
| `otp:{email}` | OTP code (PJ-03) | 5m |
| `otp:retry:{email}` | OTP retry count (PJ-03) | 15m |
| `reset:{token}` | Password reset (PJ-03) | 15m |
| `booking:temp:{orderId}` | Temp booking (PJ-06) | 15m |
| `cache:tickets:list` | Ticket list cache (PJ-13) | 30s |
| `ratelimit:login:{ip}` | Login rate limit (PJ-13) | 15m |
| `presence:{userId}` | Online status (PJ-10) | 5m |

### Redis Shell

```bash
redis-cli

# Session အားလုံး
KEYS session:*

# TTL စစ်
TTL session:6abc...:uuid-...

# Specific key
GET session:6abc...:uuid-...
```

---

## 9. Branch Strategy

```
main                                    ← stable
 │
 ├── feat/pj01-foundation               ✅ done
 ├── feat/pj02-auth                     ✅ done
 ├── feat/pj03-auth-advanced            
 ├── feat/pj04-rbac-user
 ├── feat/pj05-ticket
 ├── feat/pj06-order  //

 ├── feat/pj07-payment
 ├── feat/pj08-purchased-ticket
 ├── feat/pj09-support
 ├── feat/pj10-socket-chat
 ├── feat/pj11-minio-attachment
 ├── feat/pj12-notification
 ├── feat/pj13-redis-deep
 ├── feat/pj14-logging-clickhouse
 ├── feat/pj15-admin
 ├── feat/pj16-security
 ├── feat/pj17-testing
 ├── feat/pj18-swagger
 ├── feat/pj19-refactor
 ├── feat/pj20-performance
 ├── feat/pj21-docker-full
 ├── feat/pj22-cicd
 ├── feat/pj23-frontend-integration
 └── feat/pj24-deployment
```

**Rule:**
```bash
# PJ စတိုင်း
git checkout main
git pull origin main
git checkout -b feat/pjXX-name

# PJ ပြီးရင်
git push origin feat/pjXX-name
# → PR → merge to main
git branch -d feat/pjXX-name
```

---

## 10. Troubleshooting

### MongoDB Connection Refused

```bash
# Container run နေလား
docker ps | grep mongo

# မရှိရင်
docker start dev-mongo

# Log စစ်
docker logs dev-mongo
```

### Redis Connection Refused

```bash
docker ps | grep redis
docker start dev-redis
docker logs dev-redis
```

### `Nest could not find JwtService`

**ဖြစ်ရတဲ့ အကြောင်း:** `main.ts` မှာ `app.get('JwtService')` (string) သုံး။

**Fix:** `JwtModule` ကို `global: true` + `APP_GUARD` provider သုံး။

### User ကို `/users/me` မှာ ရှာမတွေ့

**ဖြစ်ရတဲ့ အကြောင်း:** Token က user id ကို ညွှန်း ဒါပေမဲ့ DB မှာ user ဖျက်ပြီး။

**Fix:** Login ပြန် / Register အသစ်။

### `AUTH_TOKEN_INVALID`

**ဖြစ်ရတဲ့ အကြောင်း:**
- Token expire (15m)
- `JWT_ACCESS_SECRET` ပြောင်း
- Token က refresh (type check fail)

**Fix:**
```bash
# Login ပြန်
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_EMAIL","password":"YOUR_PASSWORD"}' | jq
```

### Port 3000 already in use

```bash
lsof -i :3000
kill -9 <PID>
# ဒါမှမဟုတ်
PORT=3001 npm run start:dev
```

---

## 11. PJ Progress

| PJ | Description | Status |
|---|---|---|
| PJ-01 | Foundation (Request ID, Validation, Error, Response, Logger, Shared, Health) | ✅ |
| PJ-02 | Auth (Register, Login, JWT, Refresh, Logout, Guard) | ✅ |
| PJ-03 | Auth Advanced (OTP, Forgot Password, Google OAuth) | ⏳ |
| PJ-04 | RBAC + User | ⏳ |
| PJ-05 | Ticket Product | ⏳ |
| PJ-06 | Order / Booking | ⏳ |

| PJ-07 | Mock Payment | ⏳ |
| PJ-08 | Purchased Ticket | ⏳ |
| PJ-09 | Support (REST) | ⏳ |
| PJ-10 | Socket.IO Chat | ⏳ |
| PJ-11 | Attachment (MinIO) | ⏳ |
| PJ-12 | Notification | ⏳ |
| PJ-13 | Redis Deep | ⏳ |
| PJ-14 | Logging (ClickHouse) | ⏳ |
| PJ-15 | Admin Module | ⏳ |
| PJ-16 | Security Hardening | ⏳ |
| PJ-17 | Testing | ⏳ |
| PJ-18 | Swagger | ⏳ |
| PJ-19 | Architecture Refactor | ⏳ |
| PJ-20 | Performance | ⏳ |
| PJ-21 | Docker Full Stack | ⏳ |
| PJ-22 | CI/CD | ⏳ |
| PJ-23 | Frontend Integration | ⏳ |
| PJ-24 | Deployment | ⏳ |

---

## 12. Scripts

```bash
npm run start          # Run once
npm run start:dev      # Dev (hot reload)
npm run start:prod     # Prod (built)
npm run build          # Build
npm run lint           # Lint
npm run test           # Unit tests
npm run test:e2e       # E2E
```

---

**Last Updated:** PJ-02 complete
**Maintainer:** Chan