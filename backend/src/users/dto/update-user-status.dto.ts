import { IsEnum } from 'class-validator';
import { UserStatus } from '../schemas/user.schema';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus, {
    message: 'status must be active/inactive/banned',
  })
  status!: UserStatus;
}
