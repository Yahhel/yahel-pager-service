import { ApiProperty } from '@nestjs/swagger';
import { IsDefined, IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendEmailVerificationTokenDto {
  @ApiProperty()
  @IsDefined()
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase())
  email: string;
}
