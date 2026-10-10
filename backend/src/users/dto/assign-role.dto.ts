import { IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignRoleDto {
  @ApiProperty({ description: 'Role ObjectId' })
  @IsMongoId({ message: 'roleId must be a valid ObjectId' })
  roleId!: string;
}
