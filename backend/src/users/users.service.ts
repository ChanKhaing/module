import { Injectable, ConflictException , Logger , NotFoundException} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto , UpdateProfileDto} from './dto';
import { LoggerService, PaginationService, PaginationQueryDto } from '../common';  //custom 
import { PasswordService } from '../common/security';


@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,   // ← inject
    private readonly password: PasswordService,      // ← inject


  ) {}

  async create(dto: CreateUserDto) {
      this.logger.log(`Creating user: ${dto.email}`,
      UsersService.name);
    // 1. Email ရှိပြီးလား စစ်
    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) {
      this.logger.warn(`Email already exists: ${dto.email}`,
      UsersService.name);
      throw new ConflictException('Email already registered');    }

    
    const passwordHash = await this.password.hash(dto.password);   // ← hash

    const user = await this.userModel.create({
      email: dto.email,
      passwordHash,                     // ← hash ထည့်
      fullName: dto.fullName,
      phone: dto.phone,
      role: dto.role,
    });



    // 3. Response ကနေ password ဖျက်
    const obj = user.toObject();
    delete (obj as any).passwordHash;
    this.logger.log(`User created: ${user._id}`, UsersService.name);
    return obj;
  }

 async findAll(query: PaginationQueryDto) {
    const { page, limit, skip, sort } = this.pagination.normalize(query);

    const [data, total] = await Promise.all([
      this.userModel
        .find()
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments().exec(),
    ]);

    return {
      data,
      ...this.pagination.buildMeta(page, limit, total),
    };
  }
  
    async findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email })
      .select('+passwordHash')
      .lean()
      .exec();
  }

  async findById(id: string) {
  const user = await this.userModel
    .findById(id)
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

async updateProfile(userId: string, dto: UpdateProfileDto) {
  const user = await this.userModel
    .findByIdAndUpdate(
      userId,
      { $set: dto },
      { new: true, runValidators: true },
    )
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

  async findByEmail(email: string, withPassword = false) {
    const query = this.userModel.findOne({ email });
    if (withPassword) {
      query.select('+password');
    }
    return query.exec();
  }
}