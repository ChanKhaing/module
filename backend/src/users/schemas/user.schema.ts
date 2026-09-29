import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ADMIN = 'admin',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true, select: false })  
  password!: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;
}

export const UserSchema = SchemaFactory.createForClass(User);