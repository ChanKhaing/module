import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsEnum,
  Matches,
} from 'class-validator';
import { UserRole } from '../schemas/user.schema';

export class CreateUserDto {
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(64)
  password!: string;

  @IsString()
  @MinLength(2, { message: 'fullName must be at least 2 characters' })
  @MaxLength(100)
  fullName!: string;                          

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string | number ;                             

  @IsOptional()
  @IsEnum(UserRole, { message: 'role must be customer/agent/admin' })
  role?: UserRole;
}