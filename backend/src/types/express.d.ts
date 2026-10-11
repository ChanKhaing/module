import 'express';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: {
        // JwtPayload shape (used by @CurrentUser() in controllers)
        sub: string;
        email: string;
        role: string;
        permissions: string[];
        jti?: string;
        type?: 'access' | 'refresh';
        // Express-style (backward compat)
        id: string;
        roles: string[];
      };
    }
  }
}

export {};
