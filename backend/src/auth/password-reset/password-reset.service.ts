import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';

import { User, UserDocument } from '../../users/schemas/user.schema';
import { RedisService, RedisKeys, RedisTTL } from '../../infra/redis';
import { MailService } from '../../infra/mail/mail.service';
import { resetPasswordTemplate } from '../../infra/mail/templates/reset-password.template';
import { PasswordService } from '../../common/security';
import { LoggerService } from '../../common';

@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly password: PasswordService,
    private readonly logger: LoggerService,
  ) {}

  // ─────────────────────────────────────────
  // REQUEST — send reset link
  // ─────────────────────────────────────────
  async requestReset(email: string): Promise<{
    message: string;
    expiresIn: number;
  }> {
    const user = await this.userModel.findOne({ email }).exec();

    // ⚠️ Email enumeration block — user ရှိလည်း၊ မရှိလည်း တူညီတဲ့ response
    if (!user) {
      this.logger.warn(
        `Reset requested for unknown email: ${email}`,
        PasswordResetService.name,
      );

      return {
        message: 'If the email exists, a reset link has been sent.',
        expiresIn: RedisTTL.RESET_TOKEN,
      };
    }

    // User status စစ် (banned/inactive user ကို reset ခွင့်မပြု)
    if (user.status !== 'active') {
      this.logger.warn(
        `Reset requested for inactive/banned user: ${email}`,
        PasswordResetService.name,
      );

      return {
        message: 'If the email exists, a reset link has been sent.',
        expiresIn: RedisTTL.RESET_TOKEN,
      };
    }

    // Reset token generate (crypto random 32 bytes → 64 hex chars)
    const token = randomBytes(32).toString('hex');
    const key = RedisKeys.resetToken(token);

    // Redis store: token → userId
    await this.redis.set(key, user._id.toString(), RedisTTL.RESET_TOKEN);

    // Frontend reset URL (prod မှာ domain ပြောင်း)
    const frontendUrl =
      process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    // Email
    const tpl = resetPasswordTemplate({
      fullName: user.fullName,
      resetLink,
      ttlMinutes: RedisTTL.RESET_TOKEN / 60,
    });

    await this.mail.send({
      to: email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
    });

    this.logger.log(
      `Password reset link sent: ${email}`,
      PasswordResetService.name,
    );

    return {
      message: 'If the email exists, a reset link has been sent.',
      expiresIn: RedisTTL.RESET_TOKEN,
    };
  }

  // ─────────────────────────────────────────
  // CONFIRM — verify token + update password
  // ─────────────────────────────────────────
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const key = RedisKeys.resetToken(token);

    // 1. Token ရှိလား
    const userId = await this.redis.get(key);
    if (!userId) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token is invalid or has expired',
      });
    }

    // 2. User ရှိလား
    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      await this.redis.del(key);       // cleanup
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token is invalid or has expired',
      });
    }

    // 3. Password hash
    const passwordHash = await this.password.hash(newPassword);

    // 4. User update
    user.passwordHash = passwordHash;
    await user.save();

    // 5. Token ဖျက် (single-use)
    await this.redis.del(key);

    // 6. ⚠️ Security: Session အားလုံး ဖျက်
    //    (Attacker token ခိုးပြီး reset လုပ်ရင် user ရဲ့ session ဖျက်)
    const sessionPattern = RedisKeys.userSessions(userId);
    const revoked = await this.redis.delByPattern(sessionPattern);

    this.logger.log(
      `Password reset: ${user.email} (revoked ${revoked} sessions)`,
      PasswordResetService.name,
    );

    return {
      message: 'Password reset successful. Please login again.',
    };
  }
}