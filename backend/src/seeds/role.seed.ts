import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument, RoleName } from '../roles/schemas/role.schema';
import { LoggerService } from '../common';

interface RoleDef {
  name: RoleName;
  description: string;
  isSystem: boolean;
  permissionCodes: string[];      // "*" = all
}

const ROLES: RoleDef[] = [
  {
    name: RoleName.CUSTOMER,
    description: 'Regular customer — buy tickets, request support',
    isSystem: true,
    permissionCodes: [
      'ticket:read',
      'order:read',
      'order:create',
      'order:cancel',
      'payment:read',
      'support:read',
      'support:create',
      'support:reply',
      'notification:read',
    ],
  },
  {
    name: RoleName.AGENT,
    description: 'Support agent — handle support tickets',
    isSystem: true,
    permissionCodes: [
      'ticket:read',
      'order:read',
      'payment:read',
      'support:read',
      'support:create',
      'support:reply',
      'support:resolve',
      'notification:read',
      'user:read',
    ],
  },
  {
    name: RoleName.ADMIN,
    description: 'Administrator — full access',
    isSystem: true,
    permissionCodes: ['*'],     // all
  },
];

@Injectable()
export class RoleSeed {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>,
    private readonly logger: LoggerService,
  ) {}

  async run(permissionMap: Map<string, string>): Promise<Map<string, string>> {
    const map = new Map<string, string>();   // name → ObjectId
    const allPermissionIds = Array.from(permissionMap.values()).map(
      (id) => new Types.ObjectId(id),
    );

    for (const def of ROLES) {
      const permissionIds = def.permissionCodes.includes('*')
        ? allPermissionIds
        : def.permissionCodes
            .map((code) => permissionMap.get(code))
            .filter((id): id is string => Boolean(id))
            .map((id) => new Types.ObjectId(id));

      const doc = await this.roleModel.findOneAndUpdate(
        { name: def.name },
        {
          $set: {
            description: def.description,
            permissions: permissionIds,
            isSystem: def.isSystem,
          },
          $setOnInsert: { name: def.name },
        },
        { upsert: true, new: true },
      );

      map.set(def.name, doc._id.toString());
    }

    this.logger.log(
      `Roles seeded: ${map.size} (${Array.from(map.keys()).join(', ')})`,
      RoleSeed.name,
    );

    return map;
  }
}