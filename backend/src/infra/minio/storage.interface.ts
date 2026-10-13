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

  ensureBucket(bucket: string): Promise<void>;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
