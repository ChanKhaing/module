import { IsString, IsNotEmpty } from 'class-validator';

export class LogoutDto {
  @IsString()
  @IsNotEmpty({ message: 'refreshToken is required' })
  refreshToken!: string;
}