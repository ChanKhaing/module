import { Injectable } from '@nestjs/common';
import { PaginationQueryDto } from '../dto';

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
  sort: Record<string, 1 | -1>;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

@Injectable()
export class PaginationService {
  /**
   * Query → { page, limit, skip, sort }
   */
  normalize(query: PaginationQueryDto): NormalizedPagination {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(query.limit) || DEFAULT_LIMIT),
    );
    const skip = (page - 1) * limit;

    const sort: Record<string, 1 | -1> = {};
    if (query.sort) {
      // ?sort=createdAt → { createdAt: -1 }
      // ?sort=-createdAt → { createdAt: -1 } (leading - က desc)
      const field = query.sort.startsWith('-')
        ? query.sort.slice(1)
        : query.sort;
      const direction: 1 | -1 = query.sort.startsWith('-')
        ? -1
        : query.order === 'asc'
          ? 1
          : -1;
      sort[field] = direction;
    } else {
      sort.createdAt = -1;   // default: latest first
    }

    return { page, limit, skip, sort };
  }

  /**
   * total → meta response
   */
  buildMeta(page: number, limit: number, total: number): PaginationMeta {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}