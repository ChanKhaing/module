import { describe, it, expect, beforeEach } from 'vitest';
import { PaginationService } from '../../src/common/shared/services/pagination.service';

describe('PaginationService', () => {
  let service: PaginationService;

  beforeEach(() => {
    service = new PaginationService();
  });

  describe('normalize', () => {
    it('should default page=1, limit=20', () => {
      const r = service.normalize({});
      expect(r.page).toBe(1);
      expect(r.limit).toBe(20);
      expect(r.skip).toBe(0);
    });

    it('should calculate skip correctly', () => {
      const r = service.normalize({ page: 3, limit: 10 });
      expect(r.skip).toBe(20);
    });

    it('should cap limit at 100', () => {
      const r = service.normalize({ limit: 500 });
      expect(r.limit).toBe(100);
    });

    it('should enforce min page=1', () => {
      const r = service.normalize({ page: 0 });
      expect(r.page).toBe(1);
    });

    it('should parse sort ascending', () => {
      const r = service.normalize({ sort: 'price', order: 'asc' });
      expect(r.sort).toEqual({ price: 1 });
    });

    it('should parse sort descending (default)', () => {
      const r = service.normalize({ sort: 'price' });
      expect(r.sort).toEqual({ price: -1 });
    });

    it('should parse shorthand -createdAt', () => {
      const r = service.normalize({ sort: '-createdAt' });
      expect(r.sort).toEqual({ createdAt: -1 });
    });
  });

  describe('buildMeta', () => {
    it('should calculate totalPages', () => {
      const m = service.buildMeta(1, 10, 100);
      expect(m.totalPages).toBe(10);
      expect(m.hasNext).toBe(true);
      expect(m.hasPrev).toBe(false);
    });

    it('should set hasNext=false on last page', () => {
      const m = service.buildMeta(10, 10, 100);
      expect(m.hasNext).toBe(false);
      expect(m.hasPrev).toBe(true);
    });
  });
});
