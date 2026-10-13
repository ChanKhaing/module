import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';

import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto } from './dto';
import type { MulterFile } from './types';
import { CurrentUser, RequirePermissions } from '../common';
import type { JwtPayload } from '../auth/interfaces';

@ApiTags('attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @RequirePermissions('attachment:create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  @Post()
  upload(
    @UploadedFile() file: MulterFile,
    @Body() dto: UploadAttachmentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'multipart field "file" is required',
      });
    }
    return this.attachments.upload(file, dto.refType, dto.refId, user.sub);
  }

  @RequirePermissions('attachment:read')
  @Get(':id')
  findById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const isStaff = user.role === 'admin' || user.role === 'agent';
    return this.attachments.findById(id, user.sub, isStaff);
  }

  @RequirePermissions('attachment:read')
  @Get(':id/url')
  presigned(@Param('id') id: string) {
    return this.attachments.presignedUrl(id);
  }

  @RequirePermissions('attachment:create')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const isStaff = user.role === 'admin' || user.role === 'agent';
    return this.attachments.remove(id, user.sub, isStaff);
  }
}
