import { IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserStatus } from '../schemas/user.schema';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, {
    message: 'status must be active/inactive/banned',
  })
  @ApiProperty({ description: 'active / inactive / banned' })
  status!: UserStatus;
}
