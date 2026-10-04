import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoggerService } from '../common';

@Injectable()
export class UserMigrationSeed {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly logger: LoggerService,
  ) {}

  /**
   * User.role: string ("customer") → ObjectId
   * Skip လုပ်ရင် already ObjectId
   */
  async run(roleMap: Map<string, string>): Promise<{ migrated: number; skipped: number }> {
    let migrated = 0;
    let skipped = 0;

    // String role ရှိတဲ့ user တွေ ဆွဲ
    const users = await this.userModel.find({}).lean().exec();

    for (const user of users) {
      const rawRole = user.role as unknown;

      // Already ObjectId? → skip
      if (rawRole instanceof Types.ObjectId) {
        skipped++;
        continue;
      }

      // String role ("customer") → ObjectId
      if (typeof rawRole !== 'string') {
        this.logger.warn(
          `Unexpected role type for user ${user._id}: ${typeof rawRole}`,
          UserMigrationSeed.name,
        );
        skipped++;
        continue;
      }

      const roleId = roleMap.get(rawRole);
      if (!roleId) {
        this.logger.warn(
          `Unknown role "${rawRole}" for user ${user._id}`,
          UserMigrationSeed.name,
        );
        skipped++;
        continue;
      }

      await this.userModel.updateOne(
        { _id: user._id },
        { $set: { role: new Types.ObjectId(roleId) } },
      );

      migrated++;
    }

    this.logger.log(
      `User migration: ${migrated} migrated, ${skipped} skipped`,
      UserMigrationSeed.name,
    );

    return { migrated, skipped };
  }
}