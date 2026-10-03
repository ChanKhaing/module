import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Permission, PermissionDocument } from '../permissions/schemas/permission.schema';
import { LoggerService } from '../common';

interface PermissionDef {
  resource: string;
  action: string;
  description: string;
}

const PERMISSIONS: PermissionDef[] = [
  // ─── User ───
  { resource: 'user', action: 'read', description: 'View users' },
  { resource: 'user', action: 'create', description: 'Create user' },
  { resource: 'user', action: 'update', description: 'Update user' },
  { resource: 'user', action: 'delete', description: 'Delete user' },
  { resource: 'user', action: 'manage-role', description: 'Assign role to user' },

  // ─── Role ───
  { resource: 'role', action: 'read', description: 'View roles' },
  { resource: 'role', action: 'create', description: 'Create role' },
  { resource: 'role', action: 'update', description: 'Update role' },
  { resource: 'role', action: 'delete', description: 'Delete role' },

  // ─── Permission ───
  { resource: 'permission', action: 'read', description: 'View permissions' },
  { resource: 'permission', action: 'create', description: 'Create permission' },
  { resource: 'permission', action: 'update', description: 'Update permission' },
  { resource: 'permission', action: 'delete', description: 'Delete permission' },

  // ─── Ticket ───
  { resource: 'ticket', action: 'read', description: 'View tickets' },
  { resource: 'ticket', action: 'create', description: 'Create ticket' },
  { resource: 'ticket', action: 'update', description: 'Update ticket' },
  { resource: 'ticket', action: 'delete', description: 'Delete ticket' },

  // ─── Order ───
  { resource: 'order', action: 'read', description: 'View orders' },
  { resource: 'order', action: 'create', description: 'Create order' },
  { resource: 'order', action: 'cancel', description: 'Cancel order' },

  // ─── Payment ───
  { resource: 'payment', action: 'read', description: 'View payments' },
  { resource: 'payment', action: 'refund', description: 'Refund payment' },

  // ─── Support ───
  { resource: 'support', action: 'read', description: 'View support tickets' },
  { resource: 'support', action: 'create', description: 'Create support ticket' },
  { resource: 'support', action: 'reply', description: 'Reply to support' },
  { resource: 'support', action: 'resolve', description: 'Resolve support' },

  // ─── Misc ───
  { resource: 'notification', action: 'read', description: 'View notifications' },
  { resource: 'audit', action: 'read', description: 'View audit logs' },
];

@Injectable()
export class PermissionSeed {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<PermissionDocument>,
    private readonly logger: LoggerService,
  ) {}

  async run(): Promise<Map<string, string>> {
    const map = new Map<string, string>();   // code → ObjectId

    for (const def of PERMISSIONS) {
      const code = `${def.resource}:${def.action}`;

      const doc = await this.permissionModel.findOneAndUpdate(
        { code },
        {
          $setOnInsert: {
            code,
            resource: def.resource,
            action: def.action,
            description: def.description,
          },
        },
        { upsert: true, new: true },
      );

      map.set(code, doc._id.toString());
    }

    this.logger.log(
      `Permissions seeded: ${map.size}`,
      PermissionSeed.name,
    );

    return map;
  }
}