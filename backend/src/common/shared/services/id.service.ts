import { Injectable } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';

// Confusing characters ဖျက် (0/O, 1/I/L)
const SAFE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

@Injectable()
export class IdService {
  /**
   * UUID v4
   * → "8f3b2c1a-4d5e-4f6a-9b8c-1d2e3f4a5b6c"
   */
  uuid(): string {
    return randomUUID();
  }

  /**
   * URL-safe short code (ticket code, order ref)
   * → "K7F2M9XP"
   */
  code(length = 8): string {
    if (length < 4 || length > 32) {
      throw new Error('code length must be between 4 and 32');
    }
    const bytes = randomBytes(length);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += SAFE_ALPHABET[bytes[i] % SAFE_ALPHABET.length];
    }
    return result;
  }

  /**
   * Prefixed code (order ref, ticket prefix)
   * → "ORD-K7F2M9XP"
   */
  prefixedCode(prefix: string, length = 8): string {
    return `${prefix.toUpperCase()}-${this.code(length)}`;
  }
}