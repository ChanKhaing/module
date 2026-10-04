import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RoleName } from '../schemas/role.schema';

export class CreateRoleDto {
  @IsEnum(RoleName, { message: 'name must be customer/agent/admin' })
  name!: RoleName;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
