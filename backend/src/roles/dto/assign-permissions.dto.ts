import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssignPermissionsDto {
  @ApiProperty({ description: 'Array of Permission ObjectIds' })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true, message: 'each permission must be valid ObjectId' })
  permissionIds!: string[];
}
