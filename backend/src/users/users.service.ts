import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto';
import { LoggerService } from '../common';   // ← custom

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly logger: LoggerService,      // ← inject
  ) {}

  async create(dto: CreateUserDto) {
    this.logger.log(`Creating user: ${dto.email}`, UsersService.name);

    const exists = await this.userModel.findOne({ email: dto.email });
    if (exists) {
      this.logger.warn(`Email already exists: ${dto.email}`, UsersService.name);
      throw new ConflictException('Email already registered');
    }

    const user = await this.userModel.create(dto);
    const obj = user.toObject();
    delete (obj as any).password;

    // this.logger.log(`User created: ${user._id}`, UsersService.name);
    return obj;
  }

  async findAll() {
    return this.userModel.find().exec();
  }
}