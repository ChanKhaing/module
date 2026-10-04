import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, UserDocument, UserStatus } from './schemas/user.schema';
import { Role, RoleDocument, RoleName } from '../roles/schemas/role.schema';
import { CreateUserDto, UpdateProfileDto } from './dto';
import {
  LoggerService,
  PaginationService,
  PaginationQueryDto,
} from '../common';
import { PasswordService } from '../common/security';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,
    private readonly password: PasswordService,
  ) {}

  // ─────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────
  async create(dto: CreateUserDto) {
    this.logger.log(`Creating user: ${dto.email}`, UsersService.name);

    // 1. Email ရှိပြီးလား
    const exists = await this.userModel.findOne({ email: dto.email }).exec();
    if (exists) {
      this.logger.warn(
        `Email already exists: ${dto.email}`,
        UsersService.name,
      );
      throw new ConflictException('Email already registered');
    }

    // 2. Role resolve (roleId မပါရင် default customer)
    let roleId: Types.ObjectId;
    if (dto.roleId) {
      roleId = new Types.ObjectId(dto.roleId);
    } else {
      const customerRole = await this.roleModel
        .findOne({ name: RoleName.CUSTOMER })
        .exec();
      if (!customerRole) {
        throw new Error('Default customer role not found. Run seed first.');
      }
      roleId = customerRole._id as Types.ObjectId;
    }

    // 3. Password hash
    const passwordHash = await this.password.hash(dto.password);

    // 4. Create
    const user = await this.userModel.create({
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      role: roleId,
    });

    // 5. Response ကနေ passwordHash ဖျက်
    const obj = user.toObject();
    delete (obj as any).passwordHash;

    this.logger.log(`User created: ${user._id}`, UsersService.name);

    return obj;
  }

  // ─────────────────────────────────────────
  // FIND ALL (paginated)
  // ─────────────────────────────────────────
  async findAll(query: PaginationQueryDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const [data, total] = await Promise.all([
      this.userModel
        .find()
        .populate('role', 'name description')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-passwordHash')
        .lean()
        .exec(),
      this.userModel.countDocuments().exec(),
    ]);

    return {
      data,
      ...this.pagination.buildMeta(page, limit, total),
    };
  }

  // ─────────────────────────────────────────
  // FIND BY ID
  // ─────────────────────────────────────────
  async findById(id: string) {
    const user = await this.userModel
      .findById(id)
      .populate('role', 'name description')
      .select('-passwordHash')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }

  // ─────────────────────────────────────────
  // FIND BY EMAIL (with password — for login)
  // ─────────────────────────────────────────
  async findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .lean()
      .exec();
  }

  // ─────────────────────────────────────────
  // FIND BY EMAIL (optional with password)
  // ─────────────────────────────────────────
  async findByEmail(email: string, withPassword = false) {
    const query = this.userModel.findOne({ email });
    if (withPassword) {
      query.select('+passwordHash');       // ⚠️ passwordHash (password မဟုတ်)
    }
    return query.exec();
  }

  // ─────────────────────────────────────────
  // UPDATE PROFILE
  // ─────────────────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: dto },
        { new: true, runValidators: true },
      )
      .populate('role', 'name description')
      .select('-passwordHash')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }

  // ─── ADMIN: Update status ───
  async updateStatus(id: string, status: UserStatus) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid user id' });
    }

    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true })
      .populate('role', 'name description')
      .select('-passwordHash')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    this.logger.log(`User status updated: ${user.email} → ${status}`, UsersService.name);
    return user;
  }

  // ─── ADMIN: Assign role ───
  async assignRole(userId: string, roleId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid user id' });
    }
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid role id' });
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { role: new Types.ObjectId(roleId) } },
        { new: true, runValidators: true },
      )
      .populate('role', 'name description')
      .select('-passwordHash')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    this.logger.log(`Role assigned: ${user.email}`, UsersService.name);
    return user;
  }

  // ─── ADMIN: Soft delete ───
  async softDelete(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException({ code: 'INVALID_ID', message: 'Invalid user id' });
    }

    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { $set: { deletedAt: new Date(), status: UserStatus.INACTIVE } },
        { new: true },
      )
      .select('-passwordHash')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    this.logger.log(`User soft-deleted: ${user.email}`, UsersService.name);
    return { message: 'User deleted successfully' };
  }

  // ─── SELF: Change password ───
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userModel
      .findById(userId)
      .select('+passwordHash')
      .exec();

    if (!user || !user.passwordHash) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
    }

    const valid = await this.password.verify(user.passwordHash, currentPassword);
    if (!valid) {
      throw new BadRequestException({
        code: 'PASSWORD_INCORRECT',
        message: 'Current password is incorrect',
      });
    }

    const sameAsOld = await this.password.verify(user.passwordHash, newPassword);
    if (sameAsOld) {
      throw new BadRequestException({
        code: 'PASSWORD_SAME_AS_OLD',
        message: 'New password must be different from current password',
      });
    }

    user.passwordHash = await this.password.hash(newPassword);
    await user.save();

    this.logger.log(`Password changed: ${user.email}`, UsersService.name);
    return { message: 'Password changed successfully' };
  }
}