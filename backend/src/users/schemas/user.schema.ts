import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserRole {
  CUSTOMER = 'customer',
  AGENT = 'agent',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true  ,index: true })
  email!: string;

 @Prop({ select: false })
  passwordHash?: string;

  @Prop({ required: true, trim: true })
  fullName!: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ trim: true })
  avatarUrl?: string;

  @Prop({ enum: UserRole, default: UserRole.CUSTOMER })
  role!: UserRole;
  // ─── Auth ───
  @Prop({ enum: AuthProvider, default: AuthProvider.LOCAL })
  provider!: AuthProvider;

  @Prop({ trim: true })
  providerId?: string;               // Google sub

  @Prop({ default: false })
  emailVerified!: boolean;

  // ─── Status ───
  @Prop({ enum: UserStatus, default: UserStatus.ACTIVE })
  status!: UserStatus;

  // ─── Tracking ───
  @Prop()
  lastLoginAt?: Date;

  @Prop()
  deletedAt?: Date;   
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ status: 1, createdAt: -1 });
UserSchema.index({ provider: 1, providerId: 1 }, { sparse: true });
