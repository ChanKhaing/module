import { describe, it, expect, beforeEach } from 'vitest';
import { PasswordService } from '../../src/common/security/password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('should hash a password', async () => {
    const hash = await service.hash('Passw0rd123');
    expect(hash).toBeDefined();
    expect(hash).not.toBe('Passw0rd123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('should verify correct password', async () => {
    const hash = await service.hash('Passw0rd123');
    const ok = await service.verify(hash, 'Passw0rd123');
    expect(ok).toBe(true);
  });

  it('should reject wrong password', async () => {
    const hash = await service.hash('Passw0rd123');
    const ok = await service.verify(hash, 'WrongPass456');
    expect(ok).toBe(false);
  });

  it('should return false for invalid hash', async () => {
    const ok = await service.verify('not-a-hash', 'anything');
    expect(ok).toBe(false);
  });

  it('should produce different hashes for same password', async () => {
    const h1 = await service.hash('SamePass123');
    const h2 = await service.hash('SamePass123');
    expect(h1).not.toBe(h2);
  });
});
