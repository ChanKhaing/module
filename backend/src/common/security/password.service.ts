import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class PasswordService {
  private readonly options: Parameters<typeof argon2.hash>[1] = {
    type: argon2.argon2id,     // hybrid (side-channel + GPU resistance)
    memoryCost: 2 ** 16,       // 64 MB
    timeCost: 3,               // iterations
    parallelism: 1,
  };

  /**
   * Plain → hash
   * "Passw0rd123" → "$argon2id$v=19$m=65536,t=3,p=1$..."
   */
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /**
   * Plain ↔ hash verify
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;             // invalid hash format → false
    }
  }

  /**
   * Hash လိုအပ်လား (params အဟောင်းဖြစ်နေ)
   */
  needsRehash(hash: string): boolean {
    return argon2.needsRehash(hash, this.options);
  }
}