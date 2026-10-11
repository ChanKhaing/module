import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupportPriority } from '../schemas/support-ticket.schema';

export class UpdateSupportPriorityDto {
  @ApiProperty({ enum: SupportPriority })
  @IsEnum(SupportPriority)
  priority!: SupportPriority;
}
