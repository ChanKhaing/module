import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PermissionDocument = HydratedDocument<Permission>;

@Schema({ timestamps: true, collection: 'permissions' })
export class Permission {
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  })
  code!: string;                     // "ticket:create"

  @Prop({ required: true, trim: true })
  resource!: string;                 // "ticket"

  @Prop({ required: true, trim: true, lowercase: true })
  action!: string;                   // "create"

  @Prop({ trim: true })
  description?: string;              // "Create ticket product"
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);

// Indexes
PermissionSchema.index({ resource: 1, action: 1 }, { unique: true });