import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from '../users/schemas/user.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { OtpModule } from './otp/otp.module';
import { PasswordResetModule } from './password-reset/password-reset.module';
import { PasswordResetModule } from './password-reset/password-reset.module';



@Module({
  imports: [
    // ─── Models ───
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },          // ← AuthService က roleModel inject လို့
    ]),

    // ─── Sub-features ───
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