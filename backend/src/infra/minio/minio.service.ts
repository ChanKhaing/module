import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import type { Readable } from 'stream';

import {
  PresignedUrlResult,
  StorageService,
  UploadResult,
} from './storage.interface';

@Injectable()
export class MinioService implements StorageService, OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Client;
  private readonly publicEndpoint: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.config.get<string>('MINIO_ENDPOINT') ?? 'localhost';
    const port = Number(this.config.get<string>('MINIO_PORT') ?? 9000);
    const useSSL = this.config.get<string>('MINIO_USE_SSL') === 'true';
    const accessKey = this.config.get<string>('MINIO_ACCESS_KEY') ?? '';
    const secretKey = this.config.get<string>('MINIO_SECRET_KEY') ?? '';

    this.client = new Client({
      endPoint: endpoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });

    this.publicEndpoint = `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`;
  }

  async onModuleInit(): Promise<void> {
    // Verify connection (non-fatal)
    try {
      await this.client.listBuckets();
      this.logger.log('MinIO client ready');
    } catch (err) {
      this.logger.error(`MinIO init failed: ${(err as Error).message}`);
    }
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket).catch(() => false);
    if (!exists) {
      await this.client.makeBucket(bucket);
      this.logger.log(`Bucket created: ${bucket}`);
    }
  }

  async upload(
    bucket: string,
    key: string,
    buffer: Buffer,
    mime: string,
  ): Promise<UploadResult> {
    await this.ensureBucket(bucket);

    await this.client.putObject(bucket, key, buffer, buffer.length, {
      'Content-Type': mime,
    });

    return {
      bucket,
      key,
      url: `${this.publicEndpoint}/${bucket}/${key}`,
      mime,
      size: buffer.length,
    };
  }

  async presignedGet(
    bucket: string,
    key: string,
    expiresIn = 15 * 60,
  ): Promise<PresignedUrlResult> {
    const url = await this.client.presignedGetObject(bucket, key, expiresIn);
    return { url, expiresIn };
  }

  async getStream(bucket: string, key: string): Promise<Readable> {
    return this.client.getObject(bucket, key);
  }

  async remove(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key);
  }
}
