import { IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignAgentDto {
  @ApiProperty()
  @IsMongoId()
  agentId!: string;
}
