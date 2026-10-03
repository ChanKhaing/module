import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { LoggerService } from '../common';
import { PermissionSeed } from './permission.seed';
import { RoleSeed } from './role.seed';
import { UserMigrationSeed } from './user-migration.seed';

@Injectable()
export class SeedRunner implements OnApplicationBootstrap {
  constructor(
    private readonly logger: LoggerService,
    private readonly permissionSeed: PermissionSeed,
    private readonly roleSeed: RoleSeed,
    private readonly userMigration: UserMigrationSeed,
  ) {}

  async onApplicationBootstrap() {
    // Auto-run ရင် enable (dev only)
    if (process.env.AUTO_SEED === 'true') {
      await this.run();
    }
  }

  async run() {
    this.logger.log('🌱 Seeding start...', SeedRunner.name);

    const permissionMap = await this.permissionSeed.run();
    const roleMap = await this.roleSeed.run(permissionMap);
    await this.userMigration.run(roleMap);

    this.logger.log('🌱 Seeding done', SeedRunner.name);

    return {
      permissions: permissionMap.size,
      roles: roleMap.size,
    };
  }
}