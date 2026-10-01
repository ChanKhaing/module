/**
 * Redis key patterns
 * {userId}, {jti}, {email} စတဲ့ placeholder ကို runtime ဖြည့်
 */
export const RedisKeys = {
  // ─── Auth ───
  session: (userId: string, jti: string) => `session:${userId}:${jti}`,
  userSessions: (userId: string) => `session:${userId}:*`,
  otp: (email: string) => `otp:${email}`,
  otpRetry: (email: string) => `otp:retry:${email}`,
  resetToken: (token: string) => `reset:${token}`,

  // ─── Booking ───
  bookingTemp: (orderId: string) => `booking:temp:${orderId}`,

  // ─── Cache ───
  cacheTicketsList: 'cache:tickets:list',
  cacheTicket: (id: string) => `cache:ticket:${id}`,

  // ─── Rate limit ───
  ratelimitLogin: (ip: string) => `ratelimit:login:${ip}`,
  ratelimitOtp: (email: string) => `ratelimit:otp:${email}`,
  ratelimitApi: (key: string) => `ratelimit:api:${key}`,

  // ─── Presence ───
  presence: (userId: string) => `presence:${userId}`,
} as const;

/**
 * TTL (seconds)
 */
export const RedisTTL = {
  OTP: 5 * 60,                  // 5m
  OTP_RETRY: 15 * 60,           // 15m
  RESET_TOKEN: 15 * 60,         // 15m
  SESSION: 7 * 24 * 60 * 60,    // 7d
  BOOKING_TEMP: 15 * 60,        // 15m
  CACHE_TICKET: 60,             // 1m
  CACHE_TICKET_LIST: 30,        // 30s
  RATELIMIT_LOGIN: 15 * 60,     // 15m
  RATELIMIT_OTP: 60 * 60,       // 1h
  PRESENCE: 5 * 60,             // 5m
} as const;