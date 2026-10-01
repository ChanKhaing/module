import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]{7,20}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}