import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyEmailDto {
  @ApiProperty()
  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase())
  email: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  @IsNotEmpty()
  token: string;
}
