import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { OtpModule } from './otp/otp.module';

import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetModule } from './password-reset/password-reset.module';


@Module({
  imports: [
    // User model
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    // OTP feature
    OtpModule,
    PasswordResetModule,
    // JWT – secret will be provided by service
    // (no additional JWT config needed here)
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}