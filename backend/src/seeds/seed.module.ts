import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Permission, PermissionSchema } from '../permissions/schemas/permission.schema';
import { Role, RoleSchema } from '../roles/schemas/role.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { PermissionSeed } from './permission.seed';
import { RoleSeed } from './role.seed';
import { UserMigrationSeed } from './user-migration.seed';
import { SeedRunner } from './seed.runner';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Permission.name, schema: PermissionSchema },
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [PermissionSeed, RoleSeed, UserMigrationSeed, SeedRunner],
  exports: [SeedRunner],
})
export class SeedModule {}