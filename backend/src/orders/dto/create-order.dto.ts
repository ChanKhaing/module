import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsMongoId,
  IsOptional, IsString, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class OrderItemDto {
  @IsMongoId({ message: 'ticketId must be a valid ObjectId' })
  ticketId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'qty must be at least 1' })
  qty!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
