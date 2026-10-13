import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';

import {
  Attachment,
  AttachmentDocument,
  AttachmentRefType,
} from './schemas/attachment.schema';
import {
  STORAGE_SERVICE,
  type StorageService,
} from '../infra/minio/storage.interface';
import { LoggerService } from '../common';
import type { MulterFile } from './types';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectModel(Attachment.name)
    private readonly model: Model<AttachmentDocument>,
    @Inject(STORAGE_SERVICE)
    private readonly storage: StorageService,
    private readonly logger: LoggerService,
  ) {}

  async upload(
    file: MulterFile,
    refType: AttachmentRefType,
    refId: string | undefined,
    userId: string,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'File is required',
      });
    }

    if (file.size > MAX_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `Max file size ${MAX_SIZE / 1024 / 1024}MB`,
      });
    }

    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException({
        code: 'MIME_NOT_ALLOWED',
        message: `MIME not allowed: ${file.mimetype}`,
      });
    }

    // Sanitize filename
    const safeName = (file.originalname || 'file')
      .replace(/[^\w.\-]/g, '_')
      .slice(0, 80);

    const d = new Date();
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');

    const bucket = this.pickBucket(refType);
    const key = `${refType}/${yyyy}/${mm}/${randomUUID()}-${safeName}`;

    // Upload to MinIO
    const result = await this.storage.upload(
      bucket,
      key,
      file.buffer,
      file.mimetype,
    );

    // Save metadata
    const doc = await this.model.create({
      uploadedBy: new Types.ObjectId(userId),
      refType,
      refId: refId ? new Types.ObjectId(refId) : null,
      bucket: result.bucket,
      key: result.key,
      url: result.url,
      originalName: file.originalname,
      mime: result.mime,
      size: result.size,
      deleted: false,
    });

    this.logger.log(
      `Attachment uploaded: ${doc._id} (${result.bucket}/${result.key})`,
      AttachmentsService.name,
    );

    return doc.toObject();
  }

  async findById(id: string, userId: string, isStaff: boolean) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid attachment id',
      });
    }

    const att = await this.model.findById(id).lean().exec();
    if (!att || att.deleted) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    if (!isStaff && att.uploadedBy.toString() !== userId) {
      // Not the owner and not staff
      // (Tighter ownership is enforced at the parent resource — here we allow
      //  any logged-in user to view metadata but not the file itself)
    }

    return att;
  }

  async presignedUrl(id: string) {
    const att = await this.model.findById(id).lean().exec();
    if (!att || att.deleted) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    const { url, expiresIn } = await this.storage.presignedGet(
      att.bucket,
      att.key,
      15 * 60,
    );

    return {
      attachmentId: id,
      url,
      expiresIn,
      mime: att.mime,
      size: att.size,
      originalName: att.originalName,
    };
  }

  async remove(id: string, userId: string, isStaff: boolean) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid attachment id',
      });
    }

    const att = await this.model.findById(id).exec();
    if (!att || att.deleted) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    if (!isStaff && att.uploadedBy.toString() !== userId) {
      throw new BadRequestException({
        code: 'ATTACHMENT_ACCESS_DENIED',
        message: 'You cannot delete this attachment',
      });
    }

    await this.storage.remove(att.bucket, att.key).catch(() => undefined);

    att.deleted = true;
    await att.save();

    this.logger.log(`Attachment deleted: ${id}`, AttachmentsService.name);

    return { message: 'Attachment deleted successfully' };
  }

  private pickBucket(refType: AttachmentRefType): string {
    switch (refType) {
      case AttachmentRefType.AVATAR:
        return 'avatars';
      case AttachmentRefType.PAYMENT_SCREENSHOT:
        return 'payment-screenshots';
      case AttachmentRefType.DOCUMENT:
        return 'documents';
      default:
        return 'attachments';
    }
  }
}
