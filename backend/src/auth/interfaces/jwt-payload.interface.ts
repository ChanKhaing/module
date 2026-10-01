import { UserRole } from '../../users/schemas/user.schema';

export interface JwtPayload {
  sub: string;              // userId
  email: string;
  role: UserRole;
  jti: string;              // JWT ID (refresh token အတွက်)
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}