import { IsString, Matches, MaxLength, IsOptional } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @Matches(/^[a-z]+:[a-z-]+$/, { message: 'code must be like "ticket:create"' })
  @MaxLength(64)
  code!: string;

  @IsString()
  @MaxLength(32)
  resource!: string;

  @IsString()
  @MaxLength(32)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
