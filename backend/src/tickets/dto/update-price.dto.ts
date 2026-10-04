import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class UpdatePriceDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;
}
