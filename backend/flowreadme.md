
## Prerequisites

- Node.js v18+, Docker, curl, jq, python3
- `.env` file in backend root
- Docker: `ticket-mongo`, `ticket-redis`, `mailhog`
- Seed data: `npm run seed`
- Server running: `npm run start:dev`






Step 1 
Docker 
docker run -d --name ticket-mongo -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=admin123 \
  mongo:7

docker run -d --name ticket-redis -p 6379:6379 redis:7-alpine

docker run -d --name mailhog -p 1025:1025 -p 8025:8025 mailhog/mailhog


Step2
.env   

# Server
PORT=3000

# MongoDB
MONGO_URI=mongodb://admin:admin123@localhost:27017/ticket_platform?authSource=admin

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_ACCESS_SECRET=<any-64-hex>
JWT_REFRESH_SECRET=<any-64-hex>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Mail (MailHog)
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_USER=
MAIL_PASSWORD=
MAIL_FROM="PJ-A <noreply@pja.local>

step 3 
npm run seed 

Verify 

docker exec -i ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval '
    print("Roles:", db.roles.countDocuments());
    print("Permissions:", db.permissions.countDocuments());
    print("Admin user:", db.users.countDocuments({ email: "su-test@example.com" }));

Admin user လိုအပ်ရင် မရှီရင် manual 
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"su-test@example.com","password":"Passw0rd123","fullName":"Admin"}'

# Role assign (mongosh)
docker exec -i ticket-mongo mongosh -u admin -p admin123 \
  --authenticationDatabase admin ticket_platform --quiet --eval '
    const adminRole = db.roles.findOne({ name: "admin" });
    db.users.updateOne(
      { email: "su-test@example.com" },
      { $set: { role: adminRole._id } }
    );

| Script | 
| `test-auth.sh` | Register, login, refresh, logout, OTP, reset, change-password |
| `test-users.sh` | Profile, admin user management |
| `test-roles.sh` | Role CRUD + permissions assign |
| `test-permissions.sh` | Permission CRUD |
| `test-tickets.sh` | Ticket CRUD + search + filter + publish |
| `test-orders.sh` | Order create + cancel + expiry |
| `test-payments.sh` | Payment initiate + confirm + idempotency + webhook |
| `test-purchased-tickets.sh` | List + validate + redeem + cancel |

## Run All
./run-all-tests.sh
