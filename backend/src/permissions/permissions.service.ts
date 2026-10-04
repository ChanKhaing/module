import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Permission, PermissionDocument } from './schemas/permission.schema';
import {
  LoggerService,
  PaginationService,
  PaginationQueryDto,
} from '../common';

import { CreatePermissionDto } from './dto';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<PermissionDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
  ) {}

  async create(dto: CreatePermissionDto) {
    const exists = await this.permissionModel.findOne({ code: dto.code }).exec();
    if (exists) throw new ConflictException('Permission already exists');

    const perm = await this.permissionModel.create({
      code: dto.code,
      resource: dto.resource,
      action: dto.action,
      description: dto.description,
    });

    this.logger.log(`Permission created: ${perm.code}`, PermissionsService.name);
    return perm.toObject();
  }

  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const [data, total] = await Promise.all([
      this.permissionModel.find().sort(sort).skip(skip).limit(limit).lean().exec(),
      this.permissionModel.countDocuments().exec(),
    ]);

    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException({
        code: 'INVALID_ID',
        message: 'Invalid permission id',
      });

    const perm = await this.permissionModel.findById(id).lean().exec();

    if (!perm)
      throw new NotFoundException({
        code: 'PERMISSION_NOT_FOUND',
        message: 'Permission not found',
      });

    return perm;
  }
}
