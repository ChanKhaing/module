import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TooManyRequestsException } from '../../common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomInt } from 'crypto';

import { User, UserDocument } from '../../users/schemas/user.schema';
import { RedisService, RedisKeys, RedisTTL } from '../../infra/redis';
import { MailService } from '../../infra/mail/mail.service';
import { otpTemplate } from '../../infra/mail/templates/otp.template';
import { LoggerService } from '../../common';

const OTP_LENGTH = 6;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RATE_LIMIT = 5; // per hour

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly logger: LoggerService,
  ) {}

  /** Request an OTP for the given email */
  async requestOtp(email: string): Promise<{ message: string; expiresIn: number }> {
    const rateKey = RedisKeys.ratelimitOtp(email);
    const count = await this.redis.incrWithTtl(rateKey, RedisTTL.RATELIMIT_OTP);
    if (count > OTP_RATE_LIMIT) {
      throw new TooManyRequestsException('OTP_RATE_LIMIT_EXCEEDED', 'Too many OTP requests. Please try again later.');
    }

    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      this.logger.warn(`OTP requested for unknown email: ${email}`, OtpService.name);
      return { message: 'If the email exists, an OTP has been sent.', expiresIn: RedisTTL.OTP };
    }

    const otpKey = RedisKeys.otp(email);
    await this.redis.del(otpKey);
    await this.redis.del(RedisKeys.otpRetry(email));

    const code = randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
    await this.redis.set(otpKey, code, RedisTTL.OTP);

    const tpl = otpTemplate({ fullName: user.fullName, otp: code, ttlMinutes: RedisTTL.OTP / 60 });
    await this.mail.send({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    this.logger.log(`OTP sent to ${email}`, OtpService.name);
    return { message: 'If the email exists, an OTP has been sent.', expiresIn: RedisTTL.OTP };
  }

  /** Verify an OTP */
  async verifyOtp(email: string, code: string): Promise<{ message: string; verified: boolean }> {
    const otpKey = RedisKeys.otp(email);
    const retryKey = RedisKeys.otpRetry(email);

    const stored = await this.redis.get(otpKey);
    if (!stored) {
      throw new BadRequestException('OTP_NOT_FOUND', 'OTP has expired or was never requested');
    }

    const attempts = await this.redis.incrWithTtl(retryKey, RedisTTL.OTP);
    if (attempts > OTP_MAX_ATTEMPTS) {
      await this.redis.del(otpKey);
      await this.redis.del(retryKey);
      throw new TooManyRequestsException('OTP_MAX_ATTEMPTS_EXCEEDED', 'Too many attempts. Please request a new OTP.');
    }

    if (stored !== code) {
      throw new BadRequestException('OTP_INVALID', 'OTP is incorrect');
    }

    const updatedUser = await this.userModel.findOneAndUpdate({ email }, { $set: { emailVerified: true } }, { new: true }).exec();
    if (!updatedUser) {
      throw new NotFoundException('USER_NOT_FOUND', 'User not found');
    }

    await this.redis.del(otpKey);
    await this.redis.del(retryKey);
    this.logger.log(`Email verified: ${email}`, OtpService.name);
    return { message: 'Email verified successfully', verified: true };
  }
}
