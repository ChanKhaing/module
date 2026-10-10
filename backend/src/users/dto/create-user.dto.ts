import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
  IsMongoId,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'User email' })
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;
  @ApiProperty({ description: 'Password' })

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(64)
  password!: string;
  @ApiProperty({ description: 'Full name' })

  @IsString()
  @MinLength(2, { message: 'fullName must be at least 2 characters' })
  @MaxLength(100)
  fullName!: string;                          // ← name → fullName

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;                             // ← phone အသစ်

  // ⚠️ role enum → roleId ObjectId
  @IsOptional()
  @IsMongoId({ message: 'roleId must be a valid ObjectId' })
  roleId?: string;
}

// export class CreateUserDto {
//   @IsEmail()
//   email!: string;

//   @IsString()
//   @MinLength(8)
//   @MaxLength(64)
//   password!: string;

//   @IsString()
//   @MinLength(2)
//   @MaxLength(100)
//   fullName!: string;

//   @IsOptional()
//   @IsString()
//   @MaxLength(20)
//   phone?: string;

//   @IsOptional()
//   @IsEnum(UserRole)
//   role?: UserRole;
// }