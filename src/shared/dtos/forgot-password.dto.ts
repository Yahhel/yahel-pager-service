import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDefined,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  MinLength,
} from 'class-validator';

export class ForgotPasswordDTO {
  @ApiProperty()
  @IsDefined()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase())
  @IsEmail()
  email: string;
}

export class ResetPasswordDTO {
  @ApiProperty()
  @IsDefined()
  @IsNotEmpty()
  @Transform(({ value }) => value?.toLowerCase())
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsDefined()
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  token: string;

  @ApiProperty()
  @IsDefined()
  @IsNotEmpty()
  @IsStrongPassword()
  newPassword: string;
}
