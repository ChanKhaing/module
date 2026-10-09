import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTicketDto {
  @ApiProperty({ description: 'Ticket name' })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name!: string;
  @ApiPropertyOptional({ description: 'Description' })

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
  @ApiProperty({ description: 'Price' })

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
  @ApiPropertyOptional({ description: 'Currency (MMK)' })

  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;
  @ApiProperty({ description: 'ISO date' })

  @IsDateString({}, { message: 'eventDate must be ISO date string' })
  eventDate!: string;
  @ApiProperty({ description: 'Total quantity' })

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
  @ApiPropertyOptional({ description: 'Category' })

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
  @ApiPropertyOptional({ description: 'Tags array' })

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];
  @ApiPropertyOptional({ description: 'Image URLs' })

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  images?: string[];
}
