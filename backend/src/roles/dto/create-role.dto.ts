import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoleName } from '../schemas/role.schema';

export class CreateRoleDto {
  @ApiProperty({ description: 'customer / agent / admin' })
  @IsEnum(RoleName, { message: 'name must be customer/agent/admin' })
  name!: RoleName;
  @ApiPropertyOptional({ description: 'Role description' })

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
