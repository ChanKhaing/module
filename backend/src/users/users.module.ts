import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { JwtModule } from '@nestjs/jwt'; 
import { AuthModule } from '../auth/auth.module';
import { Role, RoleSchema } from '../roles/schemas/role.schema';   // ← လိုတယ်

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },        // ← ဒါ ပါလား
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}