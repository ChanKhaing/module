import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { User, UserDocument } from './schemas/user.schema';
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
}