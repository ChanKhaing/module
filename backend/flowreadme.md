backend/README.md မှာ (သို့) စိတ်ထဲ မှတ်ထား —

Module	တာဝန်
users/	User CRUD, profile
auth/	Register, Login, JWT, OTP
tickets/	Ticket product (create, list, detail)
orders/	Order/Booking (user က ticket ဝယ်)
payments/	Payment (mock), status
support/	Support ticket, chat, attachment
common/	Shared code (guards, filters, utils)


npm i @nestjs/mongoose mongoose @nestjs/config


import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TicketsModule } from './tickets/tickets.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { SupportModule } from './support/support.module';

@Module({
  imports: [
    // 1. .env ကို global ဖတ်
    ConfigModule.forRoot({ isGlobal: true }),

    // 2. MongoDB ချိတ်
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),

    // 3. Feature modules
    UsersModule,
    AuthModule,
    TicketsModule,
    OrdersModule,
    PaymentsModule,
    SupportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}




## Step 1 — MailHog Container Run

```bash
docker run -d \
  --name mailhog \
  -p 1025:1025 \
  -p 8025:8025 \
  mailhog/mailhog
```

**စစ်:**
```bash
docker ps | grep mailhog
# → mailhog container Up
```

**Web UI ဖွင့်:**
```
http://localhost:8025
```
(စ အခါ empty ဖြစ်မယ် — mail ပို့မှ ပေါ်လာမယ်)

---

## Step 2 — `.env` ပြင်

*

**ပြောင်း:**
```env
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM="PJ-A <noreply@pja.local>"
```

**⚠️ သတိ:** `MAIL_USER=` လွတ်ထားရမယ်။ `MAIL_USER` မထည့်ရင် code က `auth: undefined` ဖြစ်မယ် — MailHog က auth မလိုလို့ အဆင်ပြေ။

---

## Step 3 — `mail.service.ts` မှာ Log ပြင် (Optional)

MailHog မှာ `getTestMessageUrl()` က `false` return ဖြစ်မယ်။ Log ကြည့်ရလွယ်အောင်:

```ts
// mail.service.ts — send() method ထဲ
const previewUrl = nodemailer.getTestMessageUrl(info);
const mailhogUrl = host === 'localhost' ? 'http://localhost:8025' : '';

this.logger.log(
  `Mail sent to ${options.to} (id=${info.messageId})` +
    (previewUrl ? ` preview=${previewUrl}` : '') +
    (mailhogUrl ? ` ui=${mailhogUrl}` : ''),
);
```

---

## Step 4 — Server Restart

```bash
# Ctrl+C → ပြန် run
npm run start:dev
```


---

## Step 5 — Test Run (Clean slate)

### 5.1 Redis ရှင်း (test အသစ် စဖို့)

```bash
docker exec -it ticket-redis redis-cli FLUSHDB
```

**⚠️ Dev DB ပဲ ဖြစ်ရမယ်** — production Redis မဖြစ်ရ။

### 5.2 Test OTP Request

```bash
EMAIL="otp-test@example.com"

curl -s -X POST http://localhost:3000/auth/otp/request \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | jq
```

**Expect:** 200
```json
{
  "success": true,
  "data": {
    "message": "If the email exists, an OTP has been sent.",
    "expiresIn": 300
  }
}
```

### 5.3 Server Log စစ်

```text
[MailService] Mail transport ready (localhost:1025)
[MailService] Mail sent to otp-test@example.com (id=...) ui=http://localhost:8025
[OtpService] OTP sent to otp-test@example.com
```

### 5.4 MailHog UI စစ်

Browser → http://localhost:8025 → **mail ပေါ်လား**

Mail ကို click → **HTML view** → OTP code ကို copy

### 5.5 Redis စစ်

```bash
docker exec -it ticket-redis redis-cli

GET otp:otp-test@example.com      # → "482917"
TTL otp:otp-test@example.com      # → ~300
GET ratelimit:otp:otp-test@example.com  # → "1"
```

### 5.6 Verify Test

```bash
OTP=$(docker exec ticket-redis redis-cli GET otp:otp-test@example.com)
echo "OTP = $OTP"

curl -s -X POST http://localhost:3000/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$OTP\"}" | jq
```

**Expect:** 200
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully",
    "verified": true
  }
}
```

### 5.7 MongoDB စစ်

```bash
mongosh

use my_database
db.users.findOne({ email: "otp-test@example.com" }, { emailVerified: 1 })
# → { _id: ..., emailVerified: true }
```

---

## Step 6 — Edge Case Tests

### Test 5 — Wrong OTP

```bash
curl -s -X POST http://localhost:3000/auth/otp/request \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | jq

curl -s -X POST http://localhost:3000/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"code\":\"000000\"}" | jq
```

**Expect:** 400 + `OTP_INVALID`

### Test 6 — Max Attempts

```bash
for i in 1 2 3; do
  curl -s -X POST http://localhost:3000/auth/otp/verify \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"code\":\"000000\"}" | jq -r '.error.code'
done
```

**Expect:**
```
"OTP_INVALID"
"OTP_INVALID"
"OTP_MAX_ATTEMPTS_EXCEEDED"
```

### Test 7 — Rate Limit

```bash
for i in 1 2 3 4 5 6; do
  curl -s -X POST http://localhost:3000/auth/otp/request \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\"}" | jq -r '.error.code // "ok"'
done
```

**Expect:** 5 ခု ok, နောက်ဆုံး `OTP_RATE_LIMIT_EXCEEDED`

### Test 8 — Enumeration Block

```bash
curl -s -X POST http://localhost:3000/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com"}' | jq
```

**Expect:** 200 + **တူညီတဲ့ message** (user မရှိလည်း)


##########################################################################################################################
.env မှာ FRONTEND_URL ထည့်   testing for forget password 
env
# ─── Frontend ───
FRONTEND_URL=http://localhost:5173
Prod မှာ: https://yourdomain.com

Server restart:

bash
npm run start:dev
Expect log:

text
[Nest] ... Mapped {/auth/forgot, POST} route
[Nest] ... Mapped {/auth/reset, POST} route
Test Setup
bash
EMAIL="reset-test@example.com"
PASSWORD_OLD="OldPass123"
PASSWORD_NEW="NewPass456"

# User register + verify email (optional)
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD_OLD\",\"fullName\":\"Reset Test\"}" | jq '.data.user.id'

Test 1 — Forgot Request
bash
curl -s -X POST http://localhost:3000/auth/forgot \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | jq
Expect: 200

json
{
  "success": true,
  "data": {
    "message": "If the email exists, a reset link has been sent.",
    "expiresIn": 900
  }
}
Test 2 — MailHog UI စစ်
Browser → http://localhost:8025

Expect: Mail တစ်စောင် ပေါ်
Click → HTML view → Reset link ကို copy

URL format:

text
http://localhost:5173/reset-password?token=<64-hex-chars>
Test 3 — Redis စစ်
bash
docker exec -it dev-redis redis-cli

# Reset token ရှား
KEYS reset:*

# Expect: "reset:<token>"

# Value စစ် (userId)
GET reset:<token>

# TTL
TTL reset:<token>
# → ~900
သို့မဟုတ် server-side script:

bash
TOKEN=$(docker exec dev-redis redis-cli --scan --pattern 'reset:*' | head -1 | sed 's/^reset://')
echo "Token: $TOKEN"
echo "Length: ${#TOKEN}"   # 64 hex chars
Test 4 — Reset Password
bash
TOKEN=$(docker exec dev-redis redis-cli --scan --pattern 'reset:*' | head -1 | sed 's/^reset://')

curl -s -X POST http://localhost:3000/auth/reset \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"newPassword\":\"$PASSWORD_NEW\"}" | jq
Expect: 200

json
{
  "success": true,
  "data": {
    "message": "Password reset successful. Please login again."
  }
}
Test 5 — Redis Token ဖျက်ပြီးလား
bash
docker exec dev-redis redis-cli KEYS 'reset:*'
# → (empty) — token ဖျက်ပြီး
Test 6 — Login (new password)
bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD_NEW\"}" | jq '.data.user.email'

# Expect: "reset-test@example.com"
Test 7 — Login (old password)
bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD_OLD\"}" | jq '.error.code'

# Expect: "AUTH_INVALID_CREDENTIALS"
Test 8 — Token ကို ပြန် သုံး (single-use check)
bash
curl -s -X POST http://localhost:3000/auth/reset \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN\",\"newPassword\":\"Hacked123\"}" | jq
Expect: 400

json
{
  "success": false,
  "error": {
    "code": "RESET_TOKEN_INVALID",
    "message": "Reset token is invalid or has expired"
  }
}
⚠️ ဒါက single-use ရဲ့ အလုပ်လုပ်ပုံ။

Test 9 — Session Revoke
bash
# 1. User login (session ၁ ခု ဖန်တီး)
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD_NEW\"}" \
  | jq -r '.data.accessToken')

# 2. Session ရှိလား
docker exec dev-redis redis-cli KEYS "session:*"

# 3. Forgot ပြန် + Reset
curl -s -X POST http://localhost:3000/auth/forgot \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\"}" | jq

TOKEN2=$(docker exec dev-redis redis-cli --scan --pattern 'reset:*' | head -1 | sed 's/^reset://')

curl -s -X POST http://localhost:3000/auth/reset \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$TOKEN2\",\"newPassword\":\"$PASSWORD_OLD\"}" | jq

# 4. Session အားလုံး ဖျက်ပြီးလား
docker exec dev-redis redis-cli KEYS "session:*"
# → (empty)
Test 10 — Enumeration Block
bash
curl -s -X POST http://localhost:3000/auth/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@example.com"}' | jq
Expect: 200 + တူညီတဲ့ message

json
{
  "success": true,
  "data": {
    "message": "If the email exists, a reset link has been sent.",
    "expiresIn": 900
  }
}
⚠️ User မရှိလည်း အောင်တဲ့ response — attacker က user ရှိလား မရှိလား မသိ။

Test 11 — Invalid Token
bash
curl -s -X POST http://localhost:3000/auth/reset \
  -H "Content-Type: application/json" \
  -d '{"token":"invalid-token-here-invalid-token-here-invalid-token-here","newPassword":"NewPass123"}' | jq
Expect: 400 + RESET_TOKEN_INVALID

Test 12 — Short Token (DTO validation)
bash
curl -s -X POST http://localhost:3000/auth/reset \
  -H "Content-Type: application/json" \
  -d '{"token":"short","newPassword":"NewPass123"}' | jq
Expect: 400 + token is invalid (min 32)
