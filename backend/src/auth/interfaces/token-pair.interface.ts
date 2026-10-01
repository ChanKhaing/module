export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: number;      // seconds
  refreshExpiresIn: number;     // seconds
}