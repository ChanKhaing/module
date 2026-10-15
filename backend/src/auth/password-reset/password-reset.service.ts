import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes, randomInt } from 'crypto';

import { User, UserDocument, UserStatus } from '../../users/schemas/user.schema';
import { RedisService, RedisKeys, RedisTTL } from '../../infra/redis';
import { MailService } from '../../infra/mail/mail.service';
import { otpTemplate } from '../../infra/mail/templates/otp.template';
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
  // REQUEST — check user, verify emailVerified, send OTP
  // ─────────────────────────────────────────
  async requestReset(email: string): Promise<{
    message: string;
    email: string;
    expiresIn: number;
  }> {
    const user = await this.userModel.findOne({ email }).exec();

    // 1. Check if user exists in DB
    if (!user) {
      this.logger.warn(
        `Reset requested for unknown email: ${email}`,
        PasswordResetService.name,
      );
      throw new NotFoundException({
        code: 'EMAIL_NOT_FOUND',
        message: 'No account registered with this email address.',
      });
    }

    // 2. Check if user status is active
    if (user.status === UserStatus.BANNED) {
      throw new ForbiddenException({
        code: 'ACCOUNT_BANNED',
        message: 'This account has been banned.',
      });
    }

    if (user.status === UserStatus.INACTIVE) {
      throw new ForbiddenException({
        code: 'ACCOUNT_INACTIVE',
        message: 'This account is currently inactive.',
      });
    }

    // 3. Verify that user's email is already verified
    if (!user.emailVerified) {
      this.logger.warn(
        `Reset requested for unverified email: ${email}`,
        PasswordResetService.name,
      );
      throw new BadRequestException({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email is not verified yet. Please verify your email before requesting a password reset.',
      });
    }

    // 4. Generate 6-digit OTP code & store in Redis
    const code = randomInt(0, 10 ** 6).toString().padStart(6, '0');
    const otpKey = RedisKeys.otp(email);
    await this.redis.set(otpKey, code, RedisTTL.OTP);

    // 5. Send OTP via Email
    const tpl = otpTemplate({
      fullName: user.fullName,
      otp: code,
      ttlMinutes: RedisTTL.OTP / 60,
    });

    await this.mail.send({
      to: email,
      subject: `Password Reset Code: ${code}`,
      html: tpl.html,
      text: tpl.text,
    });

    this.logger.log(`Password reset OTP sent: ${email}`, PasswordResetService.name);

    return {
      message: 'Verification code sent to your verified email.',
      email,
      expiresIn: RedisTTL.OTP,
    };
  }

  // ─────────────────────────────────────────
  // VERIFY OTP — validate code & issue reset token
  // ─────────────────────────────────────────
  async verifyResetOtp(
    email: string,
    code: string,
  ): Promise<{ message: string; resetToken: string }> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found.',
      });
    }

    const otpKey = RedisKeys.otp(email);
    const stored = await this.redis.get(otpKey);

    if (!stored) {
      throw new BadRequestException({
        code: 'OTP_EXPIRED',
        message: 'Verification code has expired or was never requested. Please request a new code.',
      });
    }

    if (stored !== code) {
      throw new BadRequestException({
        code: 'OTP_INVALID',
        message: 'Verification code is incorrect.',
      });
    }

    // OTP is valid -> delete OTP key
    await this.redis.del(otpKey);

    // Generate secure resetToken (valid for 15 minutes)
    const resetToken = randomBytes(32).toString('hex');
    const tokenKey = RedisKeys.resetToken(resetToken);
    await this.redis.set(tokenKey, user._id.toString(), RedisTTL.RESET_TOKEN);

    this.logger.log(`Password reset OTP verified: ${email}`, PasswordResetService.name);

    return {
      message: 'Code verified successfully. You may now reset your password.',
      resetToken,
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

    const userId = await this.redis.get(key);
    if (!userId) {
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token is invalid or has expired',
      });
    }

    const user = await this.userModel.findById(userId).exec();
    if (!user) {
      await this.redis.del(key);
      throw new BadRequestException({
        code: 'RESET_TOKEN_INVALID',
        message: 'Reset token is invalid or has expired',
      });
    }

    const passwordHash = await this.password.hash(newPassword);

    user.passwordHash = passwordHash;
    await user.save();

    await this.redis.del(key);

    // Session အားလုံး ဖျက်
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