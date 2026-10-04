import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Role, RoleDocument } from './schemas/role.schema';
import {
  Permission,
  PermissionDocument,
} from '../permissions/schemas/permission.schema';
import {
  LoggerService,
  PaginationService,
  PaginationQueryDto,
} from '../common';

import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name)
    private permissionModel: Model<PermissionDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
  ) {}

  async create(dto: CreateRoleDto) {
    const exists = await this.roleModel.findOne({ name: dto.name }).exec();
    if (exists) throw new ConflictException('Role already exists');

    const role = await this.roleModel.create({
      name: dto.name,
      description: dto.description,
      permissions: [],
      isSystem: false,
    });

    this.logger.log(`Role created: ${role.name}`, RolesService.name);
    return role.toObject();
  }

  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const [data, total] = await Promise.all([
      this.roleModel
        .find()
        .populate('permissions', 'code resource action description')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.roleModel.countDocuments().exec(),
    ]);

    return { data, ...this.pagination.buildMeta(page, limit, total) };
  }

  async findById(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid role id' });

    const role = await this.roleModel
      .findById(id)
      .populate('permissions', 'code resource action description')
      .lean()
      .exec();

    if (!role)
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found' });

    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid role id' });

    const role = await this.roleModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true, runValidators: true })
      .populate('permissions', 'code resource action description')
      .lean()
      .exec();

    if (!role)
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found' });

    this.logger.log(`Role updated: ${role.name}`, RolesService.name);
    return role;
  }

  async remove(id: string) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid role id' });

    const role = await this.roleModel.findById(id).exec();
    if (!role)
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found' });

    if (role.isSystem)
      throw new BadRequestException({
        code: 'ROLE_SYSTEM_PROTECTED',
        message: 'System roles cannot be deleted',
      });

    await this.roleModel.findByIdAndDelete(id).exec();
    this.logger.log(`Role deleted: ${role.name}`, RolesService.name);
    return { message: 'Role deleted successfully' };
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto) {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid role id' });

    const found = await this.permissionModel
      .countDocuments({ _id: { $in: dto.permissionIds } })
      .exec();

    if (found !== dto.permissionIds.length)
      throw new BadRequestException({
        code: 'PERMISSION_NOT_FOUND',
        message: 'One or more permission ids are invalid',
      });

    const role = await this.roleModel
      .findByIdAndUpdate(
        id,
        { $set: { permissions: dto.permissionIds.map((p) => new Types.ObjectId(p)) } },
        { new: true, runValidators: true },
      )
      .populate('permissions', 'code resource action description')
      .lean()
      .exec();

    if (!role)
      throw new NotFoundException({ code: 'ROLE_NOT_FOUND', message: 'Role not found' });

    this.logger.log(
      `Permissions assigned to role: ${role.name} (${dto.permissionIds.length})`,
      RolesService.name,
    );

    return role;
  }
}
