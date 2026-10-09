import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ValidateQrDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  qrPayload!: string;
}
