import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

export enum RoleName {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ADMIN = 'admin',
}

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  @Prop({
    required: true,
    unique: true,
    enum: RoleName,
    lowercase: true,
    trim: true,
  })
  name!: RoleName;

  @Prop({ trim: true })
  description?: string;

  @Prop({
    type: [{ type: Types.ObjectId, ref: 'Permission' }],
    default: [],
  })
  permissions!: Types.ObjectId[];

  @Prop({ default: false })
  isSystem!: boolean;               // true = ဖျက်လို့မရ (admin, agent, customer)
}

export const RoleSchema = SchemaFactory.createForClass(Role);