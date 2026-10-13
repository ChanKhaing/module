export interface UploadResult {
  bucket: string;
  key: string;
  url: string;
  mime: string;
  size: number;
}

export interface PresignedUrlResult {
  url: string;
  expiresIn: number;
}

import type { Readable } from 'stream';

export interface StorageService {
  upload(
    bucket: string,
    key: string,
    buffer: Buffer,
    mime: string,
  ): Promise<UploadResult>;

  presignedGet(
    bucket: string,
    key: string,
    expiresIn?: number,
  ): Promise<PresignedUrlResult>;

  remove(bucket: string, key: string): Promise<void>;

  getStream(bucket: string, key: string): Promise<Readable>;

  ensureBucket(bucket: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
