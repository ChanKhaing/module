import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto';
import { LoggerService, PaginationService, PaginationQueryDto } from '../common';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly logger: LoggerService,
    private readonly pagination: PaginationService,   // ← inject
  ) {}

  async create(dto: CreateUserDto) {
    this.logger.log(`Creating user: ${dto.email}`, UsersService.name);

    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) {
      this.logger.warn(`Email already exists: ${dto.email}`, UsersService.name);
      throw new ConflictException('Email already registered');
    }

 const user = await this.userModel.create({
    email: dto.email,
    passwordHash: dto.password,       // ← name ပြောင်း
    fullName: dto.fullName,
    phone: dto.phone,
    role: dto.role,
  });
      const obj = user.toObject();
    delete (obj as any).passwordHash;

    // this.logger.log(`User created: ${user._id}`, UsersService.name);
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


}