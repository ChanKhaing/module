
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;                // ← role name ("customer"/"agent"/"admin")
  jti: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}